const leaveModel = require("../models/leave.model");
const userModel = require("../models/user.model");
const attendanceModel = require("../models/attendance.model");
const auditLogModel = require("../models/auditLog.model");
const { AppError } = require("../utils/AppError");
const { isValidISODate, eachWorkingDay, daysBetween } = require("../utils/dates");

/**
 * Leave lifecycle: raise -> route -> decide.
 *
 * Routing is one step up the reporting line. An employee's request goes to the
 * lead named in `users.lead_id`; a lead has no lead above them, so theirs
 * (like an admin's) is routed to the admin queue and stored with a NULL
 * approver. An approved request then writes itself into attendance so the
 * monthly reports count leave and flyback days without a second source of
 * truth.
 */

/** Flyback is tracked as its own attendance status; everything else is leave. */
/**
 * The day status an approved request stamps onto the calendar.
 *
 * Working from home and flyback are working days recorded as themselves;
 * leave, sick and other are time away and all read as leave.
 */
const ATTENDANCE_STATUS_BY_TYPE = {
    wfh: "wfh",
    flyback: "flyback",
};

const attendanceStatusFor = (leaveType) =>
    ATTENDANCE_STATUS_BY_TYPE[leaveType] ?? "on_leave";

/** Who a new request from `requester` should be routed to. */
const resolveApproverId = (requester) =>
    requester.role === "employee" ? (requester.lead_id ?? null) : null;

/**
 * Whether `actor` is allowed to decide `request`.
 *
 * Admins can decide anything. A lead can only decide the requests routed to
 * them — without this check any lead could approve another lead's team.
 * Nobody may decide their own request.
 */
const assertCanDecide = (actor, request) => {
    if (request.user_id === actor.id) {
        throw new AppError("You cannot decide your own leave request.", 403);
    }
    if (actor.role === "admin") return;
    if (actor.role === "lead" && request.approver_id === actor.id) return;

    throw new AppError(
        "You are not the approver for this leave request.",
        403,
    );
};

/** Whether `actor` may read `request`. */
const assertCanView = (actor, request) => {
    if (actor.role === "admin") return;
    if (request.user_id === actor.id) return;
    if (actor.role === "lead" && request.approver_id === actor.id) return;

    throw new AppError("You do not have access to this leave request.", 403);
};

const validateDates = (startDate, endDate) => {
    if (!isValidISODate(startDate) || !isValidISODate(endDate)) {
        throw new AppError("Start and end dates must be YYYY-MM-DD dates.", 400);
    }
    if (endDate < startDate) {
        throw new AppError("End date cannot be before the start date.", 400);
    }
    if (daysBetween(startDate, endDate) > 365) {
        throw new AppError("A leave request cannot span more than a year.", 400);
    }
};

const createLeaveRequest = async ({
    userId,
    projectId = null,
    leaveType = "leave",
    startDate,
    endDate,
    reason,
    ipAddress = null,
    userAgent = null,
}) => {
    if (!leaveModel.LEAVE_TYPES.includes(leaveType)) {
        throw new AppError(
            `Invalid leave type. Expected one of: ${leaveModel.LEAVE_TYPES.join(", ")}.`,
            400,
        );
    }
    if (!reason || !String(reason).trim()) {
        throw new AppError("A reason is required.", 400);
    }
    validateDates(startDate, endDate);

    const requester = await userModel.findById(userId);
    if (!requester) {
        throw new AppError("User not found.", 404);
    }

    const approverId = resolveApproverId(requester);
    if (requester.role === "employee" && !approverId) {
        throw new AppError(
            "You have no lead assigned yet, so leave cannot be routed for approval. Please contact your administrator.",
            409,
        );
    }

    const conflicts = await leaveModel.getLeaveConflicts(
        userId,
        startDate,
        endDate,
    );
    if (conflicts.length > 0) {
        throw new AppError(
            "These dates overlap a leave request you have already submitted.",
            409,
        );
    }

    const leaveRequest = await leaveModel.createLeaveRequest({
        userId,
        projectId,
        leaveType,
        startDate,
        endDate,
        reason: String(reason).trim(),
        approverId,
    });

    await auditLogModel.createAuditLog({
        userId,
        action: "CREATE_LEAVE_REQUEST",
        entityType: "leave_request",
        entityId: leaveRequest.id,
        changes: {
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            routed_to: approverId ?? "admin",
        },
        ipAddress,
        userAgent,
    });

    return leaveModel.getLeaveRequest(leaveRequest.id);
};

const getLeaveRequest = async (leaveRequestId, actor) => {
    const request = await leaveModel.getLeaveRequest(leaveRequestId);
    if (!request) {
        throw new AppError("Leave request not found.", 404);
    }
    assertCanView(actor, request);
    return request;
};

const getMyLeaveRequests = (userId, status = null) =>
    leaveModel.getLeaveRequestsForUser(userId, status);

/**
 * The requests an approver is responsible for. A lead sees their own queue; an
 * admin sees the unrouted queue by default and can widen to everything.
 */
const getApprovalQueue = async (actor, { status = null, projectId = null, leadId = null, scope = null } = {}) => {
    if (actor.role === "admin") {
        return leaveModel.getLeaveRequestsForAdmin({
            scope: scope === "all" ? "all" : "queue",
            status,
            projectId,
            leadId,
        });
    }

    if (actor.role !== "lead") {
        throw new AppError("Only leads and admins have an approval queue.", 403);
    }

    return leaveModel.getLeaveRequestsForApprover(actor.id, { status, projectId });
};

/**
 * Approve a request and write its days into attendance.
 *
 * The status update is conditional on the row still being pending, so if two
 * approvers act at once only one write lands and the loser is told the request
 * was already decided rather than silently overwriting the first decision.
 */
const approveLeaveRequest = async (
    leaveRequestId,
    actor,
    { approvalNotes = null, ipAddress = null, userAgent = null } = {},
) => {
    const request = await leaveModel.getLeaveRequest(leaveRequestId);
    if (!request) {
        throw new AppError("Leave request not found.", 404);
    }
    assertCanDecide(actor, request);

    if (request.status !== "pending") {
        throw new AppError(
            `This request was already ${request.status}.`,
            409,
        );
    }

    const updated = await leaveModel.decideLeaveRequest(leaveRequestId, {
        status: "approved",
        decidedBy: actor.id,
        approvalNotes,
    });
    if (!updated) {
        throw new AppError("This request was already decided.", 409);
    }

    const days = eachWorkingDay(request.start_date, request.end_date);
    await attendanceModel.applyLeaveDays({
        userId: request.user_id,
        dates: days,
        status: attendanceStatusFor(request.leave_type),
        leaveRequestId: updated.id,
        projectId: request.project_id,
        notes: `Approved ${request.leave_type} request`,
    });

    await auditLogModel.createAuditLog({
        userId: actor.id,
        action: "APPROVE_LEAVE_REQUEST",
        entityType: "leave_request",
        entityId: updated.id,
        changes: {
            status: "approved",
            approval_notes: approvalNotes,
            attendance_days_written: days.length,
        },
        ipAddress,
        userAgent,
    });

    return leaveModel.getLeaveRequest(updated.id);
};

const rejectLeaveRequest = async (
    leaveRequestId,
    actor,
    { rejectionReason, ipAddress = null, userAgent = null } = {},
) => {
    if (!rejectionReason || !String(rejectionReason).trim()) {
        throw new AppError("A rejection reason is required.", 400);
    }

    const request = await leaveModel.getLeaveRequest(leaveRequestId);
    if (!request) {
        throw new AppError("Leave request not found.", 404);
    }
    assertCanDecide(actor, request);

    if (request.status !== "pending") {
        throw new AppError(`This request was already ${request.status}.`, 409);
    }

    const updated = await leaveModel.decideLeaveRequest(leaveRequestId, {
        status: "rejected",
        decidedBy: actor.id,
        rejectionReason: String(rejectionReason).trim(),
    });
    if (!updated) {
        throw new AppError("This request was already decided.", 409);
    }

    await auditLogModel.createAuditLog({
        userId: actor.id,
        action: "REJECT_LEAVE_REQUEST",
        entityType: "leave_request",
        entityId: updated.id,
        changes: { status: "rejected", rejection_reason: rejectionReason },
        ipAddress,
        userAgent,
    });

    return leaveModel.getLeaveRequest(updated.id);
};

/**
 * Withdraw a request. Cancelling an approved one also removes the attendance
 * days it wrote, so the reports stop counting leave that is no longer taken.
 */
const cancelLeaveRequest = async (
    leaveRequestId,
    actor,
    { ipAddress = null, userAgent = null } = {},
) => {
    const request = await leaveModel.getLeaveRequest(leaveRequestId);
    if (!request) {
        throw new AppError("Leave request not found.", 404);
    }

    const isOwner = request.user_id === actor.id;
    const isApprover =
        actor.role === "admin" ||
        (actor.role === "lead" && request.approver_id === actor.id);

    if (!isOwner && !isApprover) {
        throw new AppError("You cannot cancel this leave request.", 403);
    }

    if (request.status === "cancelled") {
        throw new AppError("This request is already cancelled.", 409);
    }
    if (request.status === "rejected") {
        throw new AppError("A rejected request cannot be cancelled.", 409);
    }

    const updated = await leaveModel.cancelLeaveRequest(leaveRequestId);
    if (!updated) {
        throw new AppError("This request can no longer be cancelled.", 409);
    }

    const cleared = await attendanceModel.clearLeaveDays(leaveRequestId);

    await auditLogModel.createAuditLog({
        userId: actor.id,
        action: "CANCEL_LEAVE_REQUEST",
        entityType: "leave_request",
        entityId: updated.id,
        changes: {
            status: "cancelled",
            attendance_days_cleared: cleared.length,
        },
        ipAddress,
        userAgent,
    });

    return leaveModel.getLeaveRequest(updated.id);
};

/** Edit a still-pending request. Only its owner may. */
const updateLeaveRequest = async (
    leaveRequestId,
    actor,
    { leaveType, startDate, endDate, reason, projectId, ipAddress = null, userAgent = null } = {},
) => {
    const request = await leaveModel.getLeaveRequest(leaveRequestId);
    if (!request) {
        throw new AppError("Leave request not found.", 404);
    }
    if (request.user_id !== actor.id) {
        throw new AppError("You can only edit your own leave requests.", 403);
    }
    if (request.status !== "pending") {
        throw new AppError(
            `A ${request.status} request can no longer be edited.`,
            409,
        );
    }
    if (leaveType && !leaveModel.LEAVE_TYPES.includes(leaveType)) {
        throw new AppError("Invalid leave type.", 400);
    }

    const nextStart = startDate ?? request.start_date;
    const nextEnd = endDate ?? request.end_date;
    if (startDate || endDate) {
        validateDates(
            typeof nextStart === "string" ? nextStart.slice(0, 10) : nextStart,
            typeof nextEnd === "string" ? nextEnd.slice(0, 10) : nextEnd,
        );

        const conflicts = await leaveModel.getLeaveConflicts(
            request.user_id,
            nextStart,
            nextEnd,
            leaveRequestId,
        );
        if (conflicts.length > 0) {
            throw new AppError(
                "These dates overlap another of your leave requests.",
                409,
            );
        }
    }

    const updated = await leaveModel.updateLeaveRequest(leaveRequestId, {
        leaveType,
        startDate,
        endDate,
        reason,
        projectId,
    });
    if (!updated) {
        throw new AppError("This request can no longer be edited.", 409);
    }

    await auditLogModel.createAuditLog({
        userId: actor.id,
        action: "UPDATE_LEAVE_REQUEST",
        entityType: "leave_request",
        entityId: updated.id,
        changes: { leaveType, startDate, endDate, reason, projectId },
        ipAddress,
        userAgent,
    });

    return leaveModel.getLeaveRequest(updated.id);
};

/** Hard-delete a request. Admin only — everyone else cancels. */
const deleteLeaveRequest = async (
    leaveRequestId,
    actor,
    { ipAddress = null, userAgent = null } = {},
) => {
    if (actor.role !== "admin") {
        throw new AppError("Only an admin can delete a leave request.", 403);
    }

    const request = await leaveModel.getLeaveRequest(leaveRequestId);
    if (!request) {
        throw new AppError("Leave request not found.", 404);
    }

    await attendanceModel.clearLeaveDays(leaveRequestId);
    const removed = await leaveModel.deleteLeaveRequest(leaveRequestId);

    await auditLogModel.createAuditLog({
        userId: actor.id,
        action: "DELETE_LEAVE_REQUEST",
        entityType: "leave_request",
        entityId: leaveRequestId,
        changes: {
            user_id: removed.user_id,
            start_date: removed.start_date,
            end_date: removed.end_date,
        },
        ipAddress,
        userAgent,
    });

    return removed;
};

module.exports = {
    createLeaveRequest,
    getLeaveRequest,
    getMyLeaveRequests,
    getApprovalQueue,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
};
