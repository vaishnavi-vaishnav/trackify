const pool = require("../database/db");

/**
 * Leave requests route one step up the reporting line: an employee's request
 * goes to their lead, a lead's (or admin's) goes to the admin queue. That
 * target is captured in `approver_id` when the request is raised — NULL means
 * the admin queue.
 */

const LEAVE_TYPES = ["vacation", "sick", "flyback", "wfh", "other"];

/** Requester, approver and project details joined onto a request row. */
const REQUEST_SELECT = `
    SELECT
        lr.*,
        u.employee_id,
        u.first_name  AS employee_first_name,
        u.last_name   AS employee_last_name,
        u.email       AS employee_email,
        u.role        AS employee_role,
        u.department  AS employee_department,
        routed.first_name AS approver_first_name,
        routed.last_name  AS approver_last_name,
        decided.first_name AS decided_by_first_name,
        decided.last_name  AS decided_by_last_name,
        p.name AS project_name,
        (lr.end_date - lr.start_date + 1) AS total_days
    FROM leave_requests lr
    JOIN users u ON u.id = lr.user_id
    LEFT JOIN users routed  ON routed.id = lr.approver_id
    LEFT JOIN users decided ON decided.id = lr.approved_by
    LEFT JOIN projects p ON p.id = lr.project_id
`;

const createLeaveRequest = async (leaveData) => {
    const result = await pool.query(
        `INSERT INTO leave_requests
             (user_id, project_id, leave_type, start_date, end_date,
              reason, approver_id, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending')
         RETURNING *;`,
        [
            leaveData.userId,
            leaveData.projectId || null,
            leaveData.leaveType || "vacation",
            leaveData.startDate,
            leaveData.endDate,
            leaveData.reason,
            leaveData.approverId || null,
        ],
    );
    return result.rows[0];
};

const getLeaveRequest = async (leaveRequestId) => {
    const result = await pool.query(`${REQUEST_SELECT} WHERE lr.id = $1;`, [
        leaveRequestId,
    ]);
    return result.rows[0];
};

const getLeaveRequestsForUser = async (userId, status = null) => {
    const params = [userId];
    let filter = "";

    if (status) {
        params.push(status);
        filter = ` AND lr.status = $${params.length}`;
    }

    const result = await pool.query(
        `${REQUEST_SELECT} WHERE lr.user_id = $1 ${filter}
         ORDER BY lr.created_at DESC;`,
        params,
    );
    return result.rows;
};

/** The queue for one lead: everything routed to them. */
const getLeaveRequestsForApprover = async (
    approverId,
    { status = null, projectId = null } = {},
) => {
    const params = [approverId];
    let filters = "";

    if (status) {
        params.push(status);
        filters += ` AND lr.status = $${params.length}`;
    }
    if (projectId) {
        params.push(projectId);
        filters += ` AND lr.project_id = $${params.length}`;
    }

    const result = await pool.query(
        `${REQUEST_SELECT} WHERE lr.approver_id = $1 ${filters}
         ORDER BY
             CASE WHEN lr.status = 'pending' THEN 0 ELSE 1 END,
             lr.created_at DESC;`,
        params,
    );
    return result.rows;
};

/**
 * The admin view. Admins both own the unrouted queue (leads' own requests) and
 * can oversee everything, so `scope` picks between them: "queue" is the
 * requests waiting on an admin decision, "all" is every request in the system.
 */
const getLeaveRequestsForAdmin = async ({
    scope = "all",
    status = null,
    projectId = null,
    leadId = null,
} = {}) => {
    const params = [];
    let filters = scope === "queue" ? " AND lr.approver_id IS NULL" : "";

    if (status) {
        params.push(status);
        filters += ` AND lr.status = $${params.length}`;
    }
    if (projectId) {
        params.push(projectId);
        filters += ` AND lr.project_id = $${params.length}`;
    }
    if (leadId) {
        params.push(leadId);
        filters += ` AND (u.lead_id = $${params.length} OR u.id = $${params.length})`;
    }

    const result = await pool.query(
        `${REQUEST_SELECT} WHERE 1 = 1 ${filters}
         ORDER BY
             CASE WHEN lr.status = 'pending' THEN 0 ELSE 1 END,
             lr.created_at DESC;`,
        params,
    );
    return result.rows;
};

/**
 * Record a decision. The status is guarded in SQL as well as in the service so
 * two approvers racing on the same request cannot both "win" — the second
 * update matches no row and the caller sees the already-decided error.
 */
const decideLeaveRequest = async (
    leaveRequestId,
    { status, decidedBy, approvalNotes = null, rejectionReason = null },
) => {
    const result = await pool.query(
        `UPDATE leave_requests
            SET status           = $2,
                approved_by      = $3,
                approval_notes   = $4,
                rejection_reason = $5,
                updated_at       = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status = 'pending'
          RETURNING *;`,
        [leaveRequestId, status, decidedBy, approvalNotes, rejectionReason],
    );
    return result.rows[0];
};

/** Withdraw a request. Only a pending or already-approved request can go. */
const cancelLeaveRequest = async (leaveRequestId) => {
    const result = await pool.query(
        `UPDATE leave_requests
            SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status IN ('pending', 'approved')
          RETURNING *;`,
        [leaveRequestId],
    );
    return result.rows[0];
};

const updateLeaveRequest = async (leaveRequestId, data) => {
    const result = await pool.query(
        `UPDATE leave_requests
            SET leave_type = COALESCE($2, leave_type),
                start_date = COALESCE($3, start_date),
                end_date   = COALESCE($4, end_date),
                reason     = COALESCE($5, reason),
                project_id = COALESCE($6, project_id),
                updated_at = CURRENT_TIMESTAMP
          WHERE id = $1
            AND status = 'pending'
          RETURNING *;`,
        [
            leaveRequestId,
            data.leaveType ?? null,
            data.startDate ?? null,
            data.endDate ?? null,
            data.reason ?? null,
            data.projectId ?? null,
        ],
    );
    return result.rows[0];
};

const deleteLeaveRequest = async (leaveRequestId) => {
    const result = await pool.query(
        "DELETE FROM leave_requests WHERE id = $1 RETURNING *;",
        [leaveRequestId],
    );
    return result.rows[0];
};

/**
 * Requests whose dates overlap [startDate, endDate] and are still live
 * (pending or approved) — used to reject double-booking.
 */
const getLeaveConflicts = async (userId, startDate, endDate, excludeId = null) => {
    const params = [userId, startDate, endDate];
    let filter = "";

    if (excludeId) {
        params.push(excludeId);
        filter = ` AND id <> $${params.length}`;
    }

    const result = await pool.query(
        `SELECT * FROM leave_requests
          WHERE user_id = $1
            AND status IN ('approved', 'pending')
            AND start_date <= $3
            AND end_date   >= $2
            ${filter};`,
        params,
    );
    return result.rows;
};

module.exports = {
    LEAVE_TYPES,
    createLeaveRequest,
    getLeaveRequest,
    getLeaveRequestsForUser,
    getLeaveRequestsForApprover,
    getLeaveRequestsForAdmin,
    decideLeaveRequest,
    cancelLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
    getLeaveConflicts,
};
