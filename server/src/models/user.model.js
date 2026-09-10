const pool = require("../database/db");

/**
 * Every account — admin, lead and employee — is a row in `users`, separated by
 * `role`. `lead_id` is the reporting line: it points at the lead an employee
 * reports to, and is NULL for leads and admins (who report to the admin queue).
 */

const ROLES = ["admin", "lead", "employee"];

/** Columns safe to return to a client — never `password` or `token_version`. */
const PUBLIC_COLUMNS = `
    id,
    employee_id,
    first_name,
    last_name,
    email,
    phone,
    department,
    designation,
    joining_date,
    role,
    lead_id,
    account_status,
    created_at,
    updated_at
`;

/** Create an account. No password yet — it is set during activation. */
const createUser = async (userData) => {
    const result = await pool.query(
        `INSERT INTO users
             (employee_id, first_name, last_name, email, phone,
              department, designation, joining_date, role, lead_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING ${PUBLIC_COLUMNS};`,
        [
            userData.employeeId,
            userData.firstName,
            userData.lastName,
            userData.email,
            userData.phone || null,
            userData.department || null,
            userData.designation || null,
            userData.joiningDate || null,
            userData.role || "employee",
            userData.leadId || null,
        ],
    );
    return result.rows[0];
};

const findByEmployeeId = async (employeeId) => {
    const result = await pool.query(
        "SELECT * FROM users WHERE employee_id = $1",
        [employeeId],
    );
    return result.rows[0];
};

const findById = async (id) => {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
    return result.rows[0];
};

const findByEmail = async (email) => {
    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
        email,
    ]);
    return result.rows[0];
};

const activateEmployee = async (employeeId, hashedPassword) => {
    const result = await pool.query(
        `UPDATE users
            SET password       = $1,
                account_status = 'active',
                updated_at     = CURRENT_TIMESTAMP
          WHERE employee_id = $2
          RETURNING employee_id, account_status;`,
        [hashedPassword, employeeId],
    );
    return result.rows[0];
};

/**
 * The directory behind every admin list view: one row per account with its
 * lead's name and the projects it touches (a lead's own projects, or the
 * projects of the lead an employee reports to).
 *
 * Filtering and paging happen in SQL rather than in the client, so the
 * directory stays a single small response however large the organisation
 * grows. `total_count` rides along via a window function, which gives the
 * filtered total without a second COUNT query.
 */
const listUsers = async ({
    role = null,
    search = null,
    leadId = null,
    status = null,
    unassignedOnly = false,
    limit = null,
    offset = 0,
} = {}) => {
    const params = [];
    let filters = "";

    if (role) {
        params.push(role);
        filters += ` AND u.role = $${params.length}`;
    }
    if (leadId) {
        params.push(leadId);
        filters += ` AND u.lead_id = $${params.length}`;
    }
    if (status) {
        params.push(status);
        filters += ` AND u.account_status = $${params.length}`;
    }
    if (unassignedOnly) {
        filters += " AND u.lead_id IS NULL AND u.role = 'employee'";
    }
    if (search) {
        params.push(`%${search}%`);
        filters += ` AND (
            u.first_name ILIKE $${params.length}
            OR u.last_name ILIKE $${params.length}
            OR u.email ILIKE $${params.length}
            OR u.employee_id ILIKE $${params.length}
            OR u.department ILIKE $${params.length}
            OR u.designation ILIKE $${params.length}
        )`;
    }

    let paging = "";
    if (limit !== null) {
        params.push(limit);
        paging += ` LIMIT $${params.length}`;
        params.push(offset);
        paging += ` OFFSET $${params.length}`;
    }

    const result = await pool.query(
        `SELECT
             u.id,
             u.employee_id,
             u.first_name,
             u.last_name,
             u.email,
             u.phone,
             u.department,
             u.designation,
             u.joining_date,
             u.role,
             u.lead_id,
             u.account_status,
             u.created_at,
             l.first_name AS lead_first_name,
             l.last_name  AS lead_last_name,
             l.employee_id AS lead_employee_id,
             (SELECT COUNT(*) FROM users e
               WHERE e.lead_id = u.id AND e.role = 'employee') AS team_size,
             COALESCE((
                 SELECT json_agg(json_build_object('id', p.id, 'name', p.name)
                                 ORDER BY p.name)
                 FROM project_leads pl
                 JOIN projects p ON p.id = pl.project_id
                 WHERE pl.lead_id = COALESCE(u.lead_id, u.id)
             ), '[]'::json) AS projects,
             COUNT(*) OVER () AS total_count
         FROM users u
         LEFT JOIN users l ON l.id = u.lead_id
         WHERE 1 = 1
         ${filters}
         ORDER BY
             CASE u.role WHEN 'admin' THEN 0 WHEN 'lead' THEN 1 ELSE 2 END,
             u.first_name, u.last_name
         ${paging};`,
        params,
    );
    return result.rows;
};

/**
 * Counts per role and per status for the whole directory, ignoring paging —
 * the filter chips need totals for the entire set, not the page on screen.
 */
const getDirectoryCounts = async () => {
    const result = await pool.query(
        `SELECT
             COUNT(*)                                             AS total,
             COUNT(*) FILTER (WHERE role = 'employee')            AS employees,
             COUNT(*) FILTER (WHERE role = 'lead')                AS leads,
             COUNT(*) FILTER (WHERE role = 'admin')               AS admins,
             COUNT(*) FILTER (WHERE account_status = 'active')    AS active,
             COUNT(*) FILTER (WHERE account_status = 'inactive')  AS inactive,
             COUNT(*) FILTER (WHERE account_status = 'pending')   AS pending,
             COUNT(*) FILTER (WHERE role = 'employee' AND lead_id IS NULL) AS unassigned
         FROM users;`,
    );

    return Object.fromEntries(
        Object.entries(result.rows[0]).map(([key, value]) => [key, Number(value)]),
    );
};

const getUserByEmployeeId = async (employeeId) => {
    const result = await pool.query(
        `SELECT
             u.id,
             u.employee_id,
             u.first_name,
             u.last_name,
             u.email,
             u.phone,
             u.department,
             u.designation,
             u.joining_date,
             u.role,
             u.lead_id,
             u.account_status,
             l.first_name  AS lead_first_name,
             l.last_name   AS lead_last_name,
             l.employee_id AS lead_employee_id
         FROM users u
         LEFT JOIN users l ON l.id = u.lead_id
         WHERE u.employee_id = $1;`,
        [employeeId],
    );
    return result.rows[0];
};

/**
 * Update a profile. Every field is optional: COALESCE leaves anything the
 * caller omitted untouched.
 *
 * `leadId` is the exception — it must be settable *to* NULL to detach someone
 * from their lead, so it is passed through a sentinel: `clearLead` true writes
 * NULL outright, otherwise an omitted leadId keeps the current value.
 */
const updateUser = async (employeeId, data) => {
    const result = await pool.query(
        `UPDATE users
            SET first_name   = COALESCE($2, first_name),
                last_name    = COALESCE($3, last_name),
                email        = COALESCE($4, email),
                phone        = COALESCE($5, phone),
                department   = COALESCE($6, department),
                designation  = COALESCE($7, designation),
                joining_date = COALESCE($8, joining_date),
                role         = COALESCE($9, role),
                lead_id      = CASE WHEN $10::boolean THEN NULL
                                    ELSE COALESCE($11::int, lead_id) END,
                updated_at   = CURRENT_TIMESTAMP
          WHERE employee_id = $1
          RETURNING ${PUBLIC_COLUMNS};`,
        [
            employeeId,
            data.firstName ?? null,
            data.lastName ?? null,
            data.email ?? null,
            data.phone ?? null,
            data.department ?? null,
            data.designation ?? null,
            data.joiningDate ?? null,
            data.role ?? null,
            data.clearLead === true,
            data.leadId ?? null,
        ],
    );
    return result.rows[0];
};

const deleteUser = async (employeeId) => {
    const result = await pool.query(
        `DELETE FROM users
          WHERE employee_id = $1
          RETURNING id, employee_id, first_name, last_name, role;`,
        [employeeId],
    );
    return result.rows[0];
};

/**
 * Flip active <-> inactive. A deactivated account must also lose its live
 * sessions, so `token_version` is bumped; `authenticate` rejects tokens minted
 * against an older version.
 */
const toggleUserStatus = async (employeeId) => {
    const result = await pool.query(
        `UPDATE users
            SET account_status = CASE WHEN account_status = 'active'
                                      THEN 'inactive' ELSE 'active' END,
                token_version  = CASE WHEN account_status = 'active'
                                      THEN token_version + 1 ELSE token_version END,
                updated_at     = CURRENT_TIMESTAMP
          WHERE employee_id = $1
          RETURNING employee_id, first_name, last_name, role, account_status;`,
        [employeeId],
    );
    return result.rows[0];
};

/** Employees reporting to a lead — used to block deleting a lead mid-team. */
const countDirectReports = async (userId) => {
    const result = await pool.query(
        "SELECT COUNT(*)::int AS count FROM users WHERE lead_id = $1",
        [userId],
    );
    return result.rows[0].count;
};

module.exports = {
    ROLES,
    createUser,
    findByEmployeeId,
    findById,
    findByEmail,
    activateEmployee,
    listUsers,
    getDirectoryCounts,
    getUserByEmployeeId,
    updateUser,
    deleteUser,
    toggleUserStatus,
    countDirectReports,
    // Kept under the original name — the activation flow imports it.
    createEmployee: createUser,
};
