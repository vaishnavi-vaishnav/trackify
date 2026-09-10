const pool = require("../database/db");

/**
 * Next free 8-digit employee id. Only ids that are exactly 8 digits take part
 * in the sequence, so manually entered ids in other formats never break it.
 */
const getNextEmployeeId = async () => {
    const result = await pool.query(
        `SELECT COALESCE(MAX(employee_id::bigint), 0) + 1 AS next_id
           FROM users
          WHERE employee_id ~ '^[0-9]{8}$';`,
    );
    return String(result.rows[0].next_id).padStart(8, "0");
};

/**
 * Headline tiles for the admin dashboard, as of today. Admins are excluded
 * from the headcount — the numbers describe the workforce being tracked.
 */
const getDashboardStatistics = async () => {
    const result = await pool.query(
        `SELECT
             (SELECT COUNT(*) FROM users WHERE role = 'employee')  AS total_employees,
             (SELECT COUNT(*) FROM users WHERE role = 'lead')      AS total_leads,
             (SELECT COUNT(*) FROM projects WHERE status = 'active') AS total_projects,
             (SELECT COUNT(*) FROM users
               WHERE role <> 'admin' AND account_status = 'pending') AS pending_activations,

             -- Everyone who has not had a day approved away from the office is
             -- in the office: the office and working counts are the headcount
             -- less the exceptions, not a tally of rows.
             (SELECT COUNT(*) FROM users
               WHERE role <> 'admin' AND account_status <> 'inactive'
                 AND COALESCE(joining_date, CURRENT_DATE) <= CURRENT_DATE) AS headcount_today,
             (SELECT GREATEST(0,
                 (SELECT COUNT(*) FROM users
                   WHERE role <> 'admin' AND account_status <> 'inactive'
                     AND COALESCE(joining_date, CURRENT_DATE) <= CURRENT_DATE)
               - (SELECT COUNT(*) FROM attendance a JOIN users u ON u.id = a.user_id
                   WHERE a.work_date = CURRENT_DATE
                     AND u.role <> 'admin' AND a.status = 'on_leave')))     AS working_today,
             (SELECT GREATEST(0,
                 (SELECT COUNT(*) FROM users
                   WHERE role <> 'admin' AND account_status <> 'inactive'
                     AND COALESCE(joining_date, CURRENT_DATE) <= CURRENT_DATE)
               - (SELECT COUNT(*) FROM attendance a JOIN users u ON u.id = a.user_id
                   WHERE a.work_date = CURRENT_DATE
                     AND u.role <> 'admin' AND a.status <> 'wfo')))         AS wfo_today,
             (SELECT COUNT(*) FROM attendance a JOIN users u ON u.id = a.user_id
               WHERE a.work_date = CURRENT_DATE
                 AND u.role <> 'admin' AND a.status = 'wfh')       AS wfh_today,
             (SELECT COUNT(*) FROM attendance a JOIN users u ON u.id = a.user_id
               WHERE a.work_date = CURRENT_DATE
                 AND u.role <> 'admin' AND a.status = 'on_leave')  AS on_leave_today,
             (SELECT COUNT(*) FROM attendance a JOIN users u ON u.id = a.user_id
               WHERE a.work_date = CURRENT_DATE
                 AND u.role <> 'admin' AND a.status = 'flyback')   AS flyback_today,

             (SELECT COUNT(*) FROM leave_requests WHERE status = 'pending') AS pending_leave;`,
    );
    return result.rows[0];
};

module.exports = {
    getNextEmployeeId,
    getDashboardStatistics,
};
