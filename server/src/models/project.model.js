const pool = require("../database/db");

/**
 * A project has many leads (`project_leads`), and each lead has many employees
 * (`users.lead_id`). A project's people are therefore reached through its
 * leads rather than stored against the project directly.
 */

const createProject = async ({ name, description = null, status = "active" }) => {
    const result = await pool.query(
        `INSERT INTO projects (name, description, status)
         VALUES ($1, $2, $3)
         RETURNING *;`,
        [name, description, status],
    );
    return result.rows[0];
};

/**
 * All projects with their lead and headcount totals, plus the leads themselves
 * so a card can name them without a request per project.
 *
 * Archived projects are included unless `activeOnly` is set — the admin list
 * needs to see them to restore them, while pickers elsewhere only offer live
 * ones. Filtering and paging are done in SQL so the list stays one small
 * response as the portfolio grows.
 */
const getAllProjects = async ({
    activeOnly = false,
    status = null,
    search = null,
    limit = null,
    offset = 0,
} = {}) => {
    const params = [];
    let filters = "";

    if (activeOnly) {
        filters += " AND p.status = 'active'";
    } else if (status) {
        params.push(status);
        filters += ` AND p.status = $${params.length}`;
    }

    if (search) {
        params.push(`%${search}%`);
        filters += ` AND (p.name ILIKE $${params.length}
                          OR p.description ILIKE $${params.length})`;
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
             p.*,
             (SELECT COUNT(*) FROM project_leads pl
               WHERE pl.project_id = p.id) AS lead_count,
             (SELECT COUNT(*) FROM users u
               WHERE u.role = 'employee'
                 AND u.lead_id IN (SELECT lead_id FROM project_leads
                                    WHERE project_id = p.id)) AS employee_count,
             COALESCE((
                 SELECT json_agg(json_build_object(
                            'id', lu.id,
                            'firstName', lu.first_name,
                            'lastName', lu.last_name)
                        ORDER BY lu.first_name)
                 FROM project_leads pl2
                 JOIN users lu ON lu.id = pl2.lead_id
                 WHERE pl2.project_id = p.id
             ), '[]'::json) AS leads,
             COUNT(*) OVER () AS total_count
         FROM projects p
         WHERE 1 = 1
         ${filters}
         ORDER BY
             CASE p.status WHEN 'active' THEN 0 ELSE 1 END,
             p.name
         ${paging};`,
        params,
    );
    return result.rows;
};

/** Portfolio-wide counts for the filter chips, ignoring the current page. */
const getProjectCounts = async () => {
    const result = await pool.query(
        `SELECT
             COUNT(*)                                     AS total,
             COUNT(*) FILTER (WHERE status = 'active')    AS active,
             COUNT(*) FILTER (WHERE status = 'archived')  AS archived,
             COUNT(*) FILTER (WHERE NOT EXISTS (
                 SELECT 1 FROM project_leads pl WHERE pl.project_id = projects.id
             )) AS without_leads
         FROM projects;`,
    );
    return Object.fromEntries(
        Object.entries(result.rows[0]).map(([k, v]) => [k, Number(v)]),
    );
};

const getProjectById = async (projectId) => {
    const result = await pool.query("SELECT * FROM projects WHERE id = $1;", [
        projectId,
    ]);
    return result.rows[0];
};

const findProjectByName = async (name, excludeId = null) => {
    const params = [name];
    let filter = "";
    if (excludeId) {
        params.push(excludeId);
        filter = ` AND id <> $${params.length}`;
    }
    const result = await pool.query(
        `SELECT * FROM projects WHERE LOWER(name) = LOWER($1) ${filter};`,
        params,
    );
    return result.rows[0];
};

const updateProject = async (projectId, { name, description, status }) => {
    const result = await pool.query(
        `UPDATE projects
            SET name        = COALESCE($2, name),
                description = COALESCE($3, description),
                status      = COALESCE($4, status),
                updated_at  = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *;`,
        [projectId, name ?? null, description ?? null, status ?? null],
    );
    return result.rows[0];
};

const deleteProject = async (projectId) => {
    const result = await pool.query(
        "DELETE FROM projects WHERE id = $1 RETURNING *;",
        [projectId],
    );
    return result.rows[0];
};

/** Leads assigned to a project, each with their team size. */
const getProjectLeads = async (projectId) => {
    const result = await pool.query(
        `SELECT
             pl.id            AS assignment_id,
             pl.project_id,
             pl.lead_id,
             u.employee_id,
             u.first_name,
             u.last_name,
             u.email,
             u.department,
             u.designation,
             u.account_status,
             d.id             AS department_id,
             d.name           AS department_name,
             (SELECT COUNT(*) FROM users e
               WHERE e.lead_id = u.id AND e.role = 'employee') AS employee_count,
             pl.created_at
         FROM project_leads pl
         JOIN users u ON u.id = pl.lead_id
         LEFT JOIN departments d ON d.id = pl.department_id
         WHERE pl.project_id = $1
         ORDER BY u.first_name, u.last_name;`,
        [projectId],
    );
    return result.rows;
};

/** Everyone working on a project, i.e. the direct reports of its leads. */
const getProjectEmployees = async (projectId) => {
    const result = await pool.query(
        `SELECT DISTINCT
             u.id,
             u.employee_id,
             u.first_name,
             u.last_name,
             u.email,
             u.department,
             u.designation,
             u.account_status,
             u.lead_id,
             l.first_name AS lead_first_name,
             l.last_name  AS lead_last_name
         FROM users u
         JOIN users l ON l.id = u.lead_id
         WHERE u.role = 'employee'
           AND u.lead_id IN (SELECT lead_id FROM project_leads WHERE project_id = $1)
         ORDER BY u.first_name, u.last_name;`,
        [projectId],
    );
    return result.rows;
};

const assignLeadToProject = async (projectId, leadId, departmentId = null) => {
    const result = await pool.query(
        `INSERT INTO project_leads (project_id, lead_id, department_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (project_id, lead_id) DO UPDATE
         SET department_id = EXCLUDED.department_id,
             updated_at    = CURRENT_TIMESTAMP
         RETURNING *;`,
        [projectId, leadId, departmentId],
    );
    return result.rows[0];
};

const removeLeadFromProject = async (projectId, leadId) => {
    const result = await pool.query(
        `DELETE FROM project_leads
          WHERE project_id = $1 AND lead_id = $2
          RETURNING *;`,
        [projectId, leadId],
    );
    return result.rows[0];
};

// --- Departments (project-scoped) ------------------------------------------

const getProjectDepartments = async (projectId) => {
    const result = await pool.query(
        `SELECT d.*,
                (SELECT COUNT(*) FROM project_leads pl
                  WHERE pl.department_id = d.id) AS lead_count
           FROM departments d
          WHERE d.project_id = $1
          ORDER BY d.name;`,
        [projectId],
    );
    return result.rows;
};

const createDepartment = async (projectId, name) => {
    const result = await pool.query(
        `INSERT INTO departments (project_id, name)
         VALUES ($1, $2)
         RETURNING *;`,
        [projectId, name],
    );
    return result.rows[0];
};

const updateDepartment = async (departmentId, name) => {
    const result = await pool.query(
        `UPDATE departments
            SET name = $2, updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
          RETURNING *;`,
        [departmentId, name],
    );
    return result.rows[0];
};

const deleteDepartment = async (departmentId) => {
    const result = await pool.query(
        "DELETE FROM departments WHERE id = $1 RETURNING *;",
        [departmentId],
    );
    return result.rows[0];
};

module.exports = {
    createProject,
    getAllProjects,
    getProjectCounts,
    getProjectById,
    findProjectByName,
    updateProject,
    deleteProject,
    getProjectLeads,
    getProjectEmployees,
    assignLeadToProject,
    removeLeadFromProject,
    getProjectDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
};
