const pool = require("../database/db");

/**
 * Attendance records *exceptions*, not attendance.
 *
 * Every employee is taken to be working from the office on every working day.
 * A row exists only where an approved request moved a day off that default, so
 * "how many office days did she have in March?" is answered by counting the
 * working days she was accountable for and subtracting the rows — never by
 * counting rows. `officeDaysExpr` below is that arithmetic, shared by every
 * query that reports a breakdown.
 */

/** The day statuses an attendance row may carry (mirrors the CHECK constraint). */
const ATTENDANCE_STATUSES = ["wfo", "wfh", "flyback", "on_leave"];

/** The statuses that are exceptions — i.e. everything a row can mean. */
const EXCEPTION_STATUSES = ["wfh", "flyback", "on_leave"];

/**
 * Working days a person is accountable for between two dates.
 *
 * Bounded below by their joining date (nobody owes office days before they
 * joined) and above by today, because tomorrow's status is not yet knowable —
 * approved leave sitting in the future is counted when that day arrives, not
 * before. Weekends are dropped, matching how an approved request is expanded.
 *
 * `userAlias` is the users alias in the surrounding query; `from`/`to` are the
 * placeholders holding the range.
 */
const accountableDaysExpr = (userAlias, from, to) => `
    (SELECT COUNT(*)
       FROM generate_series(
                GREATEST(${from}::date, COALESCE(${userAlias}.joining_date, ${from}::date)),
                LEAST(${to}::date, CURRENT_DATE),
                INTERVAL '1 day'
            ) AS d
      WHERE EXTRACT(ISODOW FROM d) < 6)`;

/**
 * Office days = accountable working days minus the exceptions actually reached.
 * Future-dated exceptions are excluded so both sides of the subtraction cover
 * the same window and the count can never go negative.
 */
const officeDaysExpr = (userAlias, from, to) => `
    GREATEST(0, ${accountableDaysExpr(userAlias, from, to)}
        - COUNT(*) FILTER (
              WHERE a.status <> 'wfo' AND a.work_date <= CURRENT_DATE
          ))`;

/** Counts of each exception, clamped to the same window as the office count. */
const exceptionCountsExpr = `
    COUNT(*) FILTER (WHERE a.status = 'wfh'      AND a.work_date <= CURRENT_DATE) AS wfh,
    COUNT(*) FILTER (WHERE a.status = 'flyback'  AND a.work_date <= CURRENT_DATE) AS flyback,
    COUNT(*) FILTER (WHERE a.status = 'on_leave' AND a.work_date <= CURRENT_DATE) AS on_leave`;

const findAttendanceOn = async (userId, workDate) => {
    const result = await pool.query(
        `SELECT a.*, p.name AS project_name
           FROM attendance a
           LEFT JOIN projects p ON p.id = a.project_id
          WHERE a.user_id = $1
            AND a.work_date = $2`,
        [userId, workDate],
    );
    return result.rows[0];
};

/**
 * The exception rows in a range. Ordinary office days are absent by
 * construction, so the caller fills them in against the calendar.
 */
const getAttendanceHistory = async (
    userId,
    { projectId = null, startDate = null, endDate = null } = {},
) => {
    const params = [userId];
    let query = `
        SELECT a.*, p.name AS project_name
          FROM attendance a
          LEFT JOIN projects p ON p.id = a.project_id
         WHERE a.user_id = $1
    `;

    if (projectId) {
        params.push(projectId);
        query += ` AND a.project_id = $${params.length}`;
    }
    if (startDate) {
        params.push(startDate);
        query += ` AND a.work_date >= $${params.length}`;
    }
    if (endDate) {
        params.push(endDate);
        query += ` AND a.work_date <= $${params.length}`;
    }

    query += " ORDER BY a.work_date DESC;";

    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * Per-employee breakdown over a date range — the row shape behind every
 * dashboard table (admin, lead, and the employee's own summary).
 *
 * Scoping is additive and all-optional: `leadId` narrows to one lead's reports,
 * `projectId` to the people whose lead runs that project, `employeeId` to one
 * person. With none of them it covers the whole organisation.
 *
 * Employees are LEFT JOINed to attendance so someone with no exceptions still
 * appears — with a full complement of office days, which is now the point.
 */
const getSummaryByEmployee = async ({
    startDate,
    endDate,
    leadId = null,
    projectId = null,
    employeeId = null,
    includeLeads = true,
} = {}) => {
    const params = [startDate, endDate];
    let scope = "";

    if (leadId) {
        params.push(leadId);
        scope += ` AND u.lead_id = $${params.length}`;
    }
    if (projectId) {
        params.push(projectId);
        scope += ` AND (
            u.lead_id IN (SELECT lead_id FROM project_leads WHERE project_id = $${params.length})
            OR u.id IN (SELECT lead_id FROM project_leads WHERE project_id = $${params.length})
        )`;
    }
    if (employeeId) {
        params.push(employeeId);
        scope += ` AND u.id = $${params.length}`;
    }

    const roleFilter = includeLeads
        ? "u.role IN ('employee', 'lead')"
        : "u.role = 'employee'";

    const query = `
        SELECT
            u.id,
            u.employee_id,
            u.first_name,
            u.last_name,
            u.email,
            u.department,
            u.designation,
            u.role,
            u.account_status,
            u.lead_id,
            l.first_name AS lead_first_name,
            l.last_name  AS lead_last_name,
            ${accountableDaysExpr("u", "$1", "$2")} AS days_recorded,
            ${officeDaysExpr("u", "$1", "$2")}      AS wfo,
            ${exceptionCountsExpr}
        FROM users u
        LEFT JOIN users l ON l.id = u.lead_id
        LEFT JOIN attendance a
               ON a.user_id = u.id
              AND a.work_date BETWEEN $1 AND $2
        WHERE ${roleFilter}
          ${scope}
        GROUP BY u.id, l.first_name, l.last_name
        ORDER BY u.first_name, u.last_name;
    `;

    const result = await pool.query(query, params);
    return result.rows;
};

/**
 * The same breakdown bucketed by ISO week, for one person. Unlike the other
 * rollups this walks the calendar rather than the rows: a week with no
 * exceptions is still a week of office days and has to appear.
 */
const getWeeklySummary = async (userId, startDate, endDate) => {
    const result = await pool.query(
        `WITH weeks AS (
             SELECT DATE_TRUNC('week', d)::date AS week_start,
                    COUNT(*)                     AS days_recorded
               FROM generate_series(
                        GREATEST($2::date, COALESCE((SELECT joining_date FROM users WHERE id = $1), $2::date)),
                        LEAST($3::date, CURRENT_DATE),
                        INTERVAL '1 day'
                    ) AS d
              WHERE EXTRACT(ISODOW FROM d) < 6
              GROUP BY 1
         ),
         exceptions AS (
             SELECT DATE_TRUNC('week', work_date)::date       AS week_start,
                    COUNT(*) FILTER (WHERE status = 'wfh')      AS wfh,
                    COUNT(*) FILTER (WHERE status = 'flyback')  AS flyback,
                    COUNT(*) FILTER (WHERE status = 'on_leave') AS on_leave,
                    COUNT(*) FILTER (WHERE status <> 'wfo')     AS off_default
               FROM attendance
              WHERE user_id = $1
                AND work_date BETWEEN $2 AND $3
                AND work_date <= CURRENT_DATE
              GROUP BY 1
         )
         SELECT w.week_start,
                (w.week_start + INTERVAL '6 days')::date AS week_end,
                w.days_recorded,
                GREATEST(0, w.days_recorded - COALESCE(e.off_default, 0)) AS wfo,
                COALESCE(e.wfh, 0)      AS wfh,
                COALESCE(e.flyback, 0)  AS flyback,
                COALESCE(e.on_leave, 0) AS on_leave
           FROM weeks w
           LEFT JOIN exceptions e ON e.week_start = w.week_start
          ORDER BY w.week_start;`,
        [userId, startDate, endDate],
    );
    return result.rows;
};

/**
 * The same breakdown bucketed by calendar day, across whichever people the
 * caller may see.
 *
 * Every working day in range comes back, because every working day has office
 * days on it whether or not anyone raised a request. The headcount each day is
 * the people who had joined by then, so a day before anyone started is empty
 * rather than fully staffed.
 */
const getDailySummary = async ({
    startDate,
    endDate,
    leadId = null,
    projectId = null,
    employeeId = null,
    includeLeads = true,
} = {}) => {
    const params = [startDate, endDate];
    let scope = "";

    if (leadId) {
        params.push(leadId);
        scope += ` AND u.lead_id = $${params.length}`;
    }
    if (employeeId) {
        params.push(employeeId);
        scope += ` AND u.id = $${params.length}`;
    }
    if (projectId) {
        params.push(projectId);
        scope += ` AND (
            u.lead_id IN (SELECT lead_id FROM project_leads WHERE project_id = $${params.length})
            OR u.id IN (SELECT lead_id FROM project_leads WHERE project_id = $${params.length})
        )`;
    }

    const roleFilter = includeLeads
        ? "u.role IN ('employee', 'lead')"
        : "u.role = 'employee'";

    const result = await pool.query(
        `WITH people AS (
             SELECT u.id, u.joining_date
               FROM users u
              WHERE ${roleFilter}
                AND u.account_status <> 'inactive'
                ${scope}
         ),
         days AS (
             SELECT d::date AS work_date
               FROM generate_series($1::date, LEAST($2::date, CURRENT_DATE), INTERVAL '1 day') AS d
              WHERE EXTRACT(ISODOW FROM d) < 6
         )
         SELECT
             days.work_date,
             (SELECT COUNT(*) FROM people
               WHERE COALESCE(people.joining_date, days.work_date) <= days.work_date) AS days_recorded,
             GREATEST(0,
                 (SELECT COUNT(*) FROM people
                   WHERE COALESCE(people.joining_date, days.work_date) <= days.work_date)
                 - COUNT(a.id) FILTER (WHERE a.status <> 'wfo')
             ) AS wfo,
             COUNT(a.id) FILTER (WHERE a.status = 'wfh')      AS wfh,
             COUNT(a.id) FILTER (WHERE a.status = 'flyback')  AS flyback,
             COUNT(a.id) FILTER (WHERE a.status = 'on_leave') AS on_leave
         FROM days
         LEFT JOIN attendance a
                ON a.work_date = days.work_date
               AND a.user_id IN (SELECT id FROM people)
         GROUP BY days.work_date
         ORDER BY days.work_date;`,
        params,
    );
    return result.rows;
};

/**
 * One row per person reporting to `leadId` with their status for `workDate`.
 * People with no exception row come back as `wfo` — the default is the answer,
 * not a gap. On a weekend nobody has a working status at all.
 */
const getTeamAttendanceForDate = async (leadId, workDate, projectId = null) => {
    const params = [leadId, workDate];
    let projectFilter = "";

    if (projectId) {
        params.push(projectId);
        projectFilter = ` AND (a.project_id = $${params.length} OR a.project_id IS NULL)`;
    }

    const result = await pool.query(
        `SELECT
             u.id,
             u.employee_id,
             u.first_name,
             u.last_name,
             u.email,
             u.department,
             u.designation,
             a.id          AS attendance_id,
             CASE
                 WHEN EXTRACT(ISODOW FROM $2::date) > 5 THEN NULL
                 WHEN COALESCE(u.joining_date, $2::date) > $2::date THEN NULL
                 ELSE COALESCE(a.status, 'wfo')
             END           AS status,
             a.notes,
             a.project_id,
             a.leave_request_id,
             p.name        AS project_name
         FROM users u
         LEFT JOIN attendance a
                ON a.user_id = u.id
               AND a.work_date = $2
               ${projectFilter}
         LEFT JOIN projects p ON p.id = a.project_id
         WHERE u.lead_id = $1
           AND u.account_status <> 'inactive'
         ORDER BY u.first_name, u.last_name;`,
        params,
    );
    return result.rows;
};

/**
 * Stamp an approved request across its working days.
 *
 * The approval is the authority on those days and tags each row with
 * `leave_request_id` — which is what lets `clearLeaveDays` undo exactly this
 * request when it is cancelled, returning those days to the office default.
 */
const applyLeaveDays = async ({
    userId,
    dates,
    status,
    leaveRequestId,
    projectId = null,
    notes = null,
}) => {
    if (!dates.length) return [];

    const result = await pool.query(
        `INSERT INTO attendance
             (user_id, project_id, work_date, status, notes, leave_request_id)
         SELECT $1, $2, day::date, $4, $5, $6
           FROM UNNEST($3::date[]) AS day
         ON CONFLICT (user_id, work_date) DO UPDATE
         SET status           = EXCLUDED.status,
             project_id       = COALESCE(EXCLUDED.project_id, attendance.project_id),
             notes            = EXCLUDED.notes,
             leave_request_id = EXCLUDED.leave_request_id,
             updated_at       = CURRENT_TIMESTAMP
         RETURNING *;`,
        [userId, projectId, dates, status, notes, leaveRequestId],
    );
    return result.rows;
};

/**
 * Undo a request's days. The rows are deleted rather than reset to `wfo`:
 * with no row meaning office, deleting is what restores the default.
 */
const clearLeaveDays = async (leaveRequestId) => {
    const result = await pool.query(
        `DELETE FROM attendance
          WHERE leave_request_id = $1
          RETURNING *;`,
        [leaveRequestId],
    );
    return result.rows;
};

/** Org-wide status counts for a single day (admin dashboard headline tiles). */
const getDayStatusCounts = async (workDate) => {
    const result = await pool.query(
        `WITH people AS (
             SELECT u.id
               FROM users u
              WHERE u.role <> 'admin'
                AND u.account_status <> 'inactive'
                AND COALESCE(u.joining_date, $1::date) <= $1::date
         ),
         marked AS (
             SELECT a.status
               FROM attendance a
              WHERE a.work_date = $1
                AND a.user_id IN (SELECT id FROM people)
         )
         SELECT
             CASE WHEN EXTRACT(ISODOW FROM $1::date) > 5 THEN 0 ELSE
                 GREATEST(0, (SELECT COUNT(*) FROM people)
                           - (SELECT COUNT(*) FROM marked WHERE status <> 'wfo'))
             END                                                          AS wfo,
             (SELECT COUNT(*) FROM marked WHERE status = 'wfh')           AS wfh,
             (SELECT COUNT(*) FROM marked WHERE status = 'flyback')       AS flyback,
             (SELECT COUNT(*) FROM marked WHERE status = 'on_leave')      AS on_leave,
             (SELECT COUNT(*) FROM people)                                AS headcount;`,
        [workDate],
    );
    return result.rows[0];
};

/**
 * Breakdown per project over a date range.
 *
 * A day is no longer booked against a project — nobody marks one any more — so
 * a project's days are its people's days, reached through the leads assigned
 * to it. Someone whose lead runs two projects counts once under each, which is
 * the same reading the per-project employee filter already had.
 */
const getSummaryByProject = async (startDate, endDate) => {
    const result = await pool.query(
        `SELECT
             p.id,
             p.name,
             p.status,
             COUNT(DISTINCT pl.lead_id)   AS lead_count,
             COUNT(DISTINCT u.id)         AS team_size,
             COALESCE(SUM(${accountableDaysExpr("u", "$1", "$2")}), 0) AS days_recorded,
             COALESCE(SUM(${accountableDaysExpr("u", "$1", "$2")}), 0)
                 - COUNT(a.id) FILTER (WHERE a.status <> 'wfo' AND a.work_date <= CURRENT_DATE) AS wfo,
             ${exceptionCountsExpr}
         FROM projects p
         LEFT JOIN project_leads pl ON pl.project_id = p.id
         LEFT JOIN users u
                ON (u.lead_id = pl.lead_id OR u.id = pl.lead_id)
               AND u.role IN ('employee', 'lead')
               AND u.account_status <> 'inactive'
         LEFT JOIN attendance a
                ON a.user_id = u.id
               AND a.work_date BETWEEN $1 AND $2
         GROUP BY p.id
         ORDER BY p.name;`,
        [startDate, endDate],
    );
    return result.rows;
};

/** Breakdown per lead's team over a date range (admin lead-wise view). */
const getSummaryByLead = async (startDate, endDate, projectId = null) => {
    const params = [startDate, endDate];
    let projectFilter = "";

    if (projectId) {
        params.push(projectId);
        projectFilter = `
            AND l.id IN (SELECT lead_id FROM project_leads WHERE project_id = $${params.length})`;
    }

    const result = await pool.query(
        `SELECT
             l.id,
             l.employee_id,
             l.first_name,
             l.last_name,
             l.email,
             l.department,
             COUNT(DISTINCT u.id)                                     AS team_size,
             COALESCE(SUM(${accountableDaysExpr("u", "$1", "$2")}), 0) AS days_recorded,
             GREATEST(0, COALESCE(SUM(${accountableDaysExpr("u", "$1", "$2")}), 0)
                 - COUNT(a.id) FILTER (WHERE a.status <> 'wfo' AND a.work_date <= CURRENT_DATE)) AS wfo,
             ${exceptionCountsExpr}
         FROM users l
         LEFT JOIN users u ON u.lead_id = l.id
                          AND u.role = 'employee'
                          AND u.account_status <> 'inactive'
         LEFT JOIN attendance a
                ON a.user_id = u.id
               AND a.work_date BETWEEN $1 AND $2
         WHERE l.role = 'lead'
         ${projectFilter}
         GROUP BY l.id
         ORDER BY l.first_name, l.last_name;`,
        params,
    );
    return result.rows;
};

module.exports = {
    ATTENDANCE_STATUSES,
    EXCEPTION_STATUSES,
    findAttendanceOn,
    getAttendanceHistory,
    applyLeaveDays,
    clearLeaveDays,
    getSummaryByEmployee,
    getWeeklySummary,
    getDailySummary,
    getTeamAttendanceForDate,
    getDayStatusCounts,
    getSummaryByProject,
    getSummaryByLead,
};
