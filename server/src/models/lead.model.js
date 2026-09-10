const pool = require("../database/db");

/**
 * All leads, with the size of their team and the projects they run.
 *
 * `search` and `projectId` narrow the list, and paging keeps it one small
 * response — the same query serves the admin's browsable grid and the smaller
 * "choose a lead" pickers, which ask for a single large page.
 */
const getAllLeads = async ({
    search = null,
    projectId = null,
    limit = null,
    offset = 0,
} = {}) => {
    const params = [];
    let filters = "";

    if (projectId) {
        params.push(projectId);
        filters += ` AND EXISTS (
            SELECT 1 FROM project_leads pl
             WHERE pl.lead_id = u.id AND pl.project_id = $${params.length}
        )`;
    }
    if (search) {
        params.push(`%${search}%`);
        filters += ` AND (
            u.first_name ILIKE $${params.length}
            OR u.last_name ILIKE $${params.length}
            OR u.email ILIKE $${params.length}
            OR u.employee_id ILIKE $${params.length}
            OR u.department ILIKE $${params.length}
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
             u.account_status,
             (SELECT COUNT(*) FROM users e
               WHERE e.lead_id = u.id AND e.role = 'employee') AS employee_count,
             COALESCE((
                 SELECT json_agg(json_build_object('id', p.id, 'name', p.name)
                                 ORDER BY p.name)
                 FROM project_leads pl
                 JOIN projects p ON p.id = pl.project_id
                 WHERE pl.lead_id = u.id
             ), '[]'::json) AS projects,
             COUNT(*) OVER () AS total_count
         FROM users u
         WHERE u.role = 'lead'
         ${filters}
         ORDER BY u.first_name, u.last_name
         ${paging};`,
        params,
    );
    return result.rows;
};

/** Totals for the filter chips, ignoring the current page. */
const getLeadCounts = async () => {
    const result = await pool.query(
        `SELECT
             COUNT(*) AS total,
             COUNT(*) FILTER (WHERE NOT EXISTS (
                 SELECT 1 FROM users e WHERE e.lead_id = u.id AND e.role = 'employee'
             )) AS without_team,
             COUNT(*) FILTER (WHERE NOT EXISTS (
                 SELECT 1 FROM project_leads pl WHERE pl.lead_id = u.id
             )) AS without_project,
             (SELECT COUNT(*) FROM users
               WHERE role = 'employee' AND lead_id IS NULL) AS unassigned_employees
         FROM users u
         WHERE u.role = 'lead';`,
    );
    return Object.fromEntries(
        Object.entries(result.rows[0]).map(([k, v]) => [k, Number(v)]),
    );
};

const getLeadById = async (leadId) => {
    const result = await pool.query(
        `SELECT id, employee_id, first_name, last_name, email, phone,
                department, designation, role, account_status
           FROM users
          WHERE id = $1 AND role = 'lead';`,
        [leadId],
    );
    return result.rows[0];
};

/**
 * A lead's direct reports. `projectId` narrows to the people whose work is
 * booked against that project — leads on several projects use it to look at
 * one team at a time.
 */
const getLeadEmployees = async (leadId, projectId = null) => {
    const params = [leadId];
    let filter = "";

    if (projectId) {
        params.push(projectId);
        filter = ` AND EXISTS (
            SELECT 1 FROM attendance a
             WHERE a.user_id = u.id AND a.project_id = $${params.length}
        )`;
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
             u.account_status
         FROM users u
         WHERE u.lead_id = $1
           AND u.role = 'employee'
           ${filter}
         ORDER BY u.first_name, u.last_name;`,
        params,
    );
    return result.rows;
};

/** The projects a lead runs. */
const getLeadProjects = async (leadId) => {
    const result = await pool.query(
        `SELECT DISTINCT
             p.id,
             p.name,
             p.description,
             p.status,
             d.id   AS department_id,
             d.name AS department_name
         FROM projects p
         JOIN project_leads pl ON pl.project_id = p.id
         LEFT JOIN departments d ON d.id = pl.department_id
         WHERE pl.lead_id = $1
           AND p.status = 'active'
         ORDER BY p.name;`,
        [leadId],
    );
    return result.rows;
};

/**
 * Point an employee at a lead (or, with a null `leadId`, detach them).
 * Restricted to role='employee' so an admin cannot accidentally file a lead
 * under another lead and create a reporting chain the queues don't model.
 */
const assignEmployeeToLead = async (employeeUserId, leadId) => {
    const result = await pool.query(
        `UPDATE users
            SET lead_id = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1 AND role = 'employee'
          RETURNING id, employee_id, first_name, last_name, lead_id;`,
        [employeeUserId, leadId],
    );
    return result.rows[0];
};

/** Employees with no lead yet — the pool an admin assigns from. */
const getUnassignedEmployees = async () => {
    const result = await pool.query(
        `SELECT id, employee_id, first_name, last_name, email,
                department, designation, account_status
           FROM users
          WHERE role = 'employee' AND lead_id IS NULL
          ORDER BY first_name, last_name;`,
    );
    return result.rows;
};

/** True when `employeeUserId` reports to `leadId` — the team-access check. */
const isDirectReport = async (leadId, employeeUserId) => {
    const result = await pool.query(
        "SELECT 1 FROM users WHERE id = $1 AND lead_id = $2",
        [employeeUserId, leadId],
    );
    return result.rowCount > 0;
};

module.exports = {
    getAllLeads,
    getLeadCounts,
    getLeadById,
    getLeadEmployees,
    getLeadProjects,
    assignEmployeeToLead,
    getUnassignedEmployees,
    isDirectReport,
};
