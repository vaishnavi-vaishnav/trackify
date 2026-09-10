const leaveService = require("../services/leave.service");
const { respondWithError } = require("../utils/AppError");

const meta = (req) => ({
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
});

const createLeaveRequest = async (req, res) => {
    try {
        const { projectId, leaveType, startDate, endDate, reason } = req.body ?? {};

        const leaveRequest = await leaveService.createLeaveRequest({
            userId: req.user.id,
            projectId: projectId || null,
            leaveType: leaveType || "vacation",
            startDate,
            endDate,
            reason,
            ...meta(req),
        });

        res.status(201).json({ success: true, data: leaveRequest });
    } catch (error) {
        respondWithError(res, error, "Create leave request");
    }
};

const getMyLeaveRequests = async (req, res) => {
    try {
        const data = await leaveService.getMyLeaveRequests(
            req.user.id,
            req.query.status || null,
        );
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get my leave requests");
    }
};

/**
 * The caller's approval queue: for a lead, the requests routed to them; for an
 * admin, the unrouted queue (leads' own requests), or everything with
 * `?scope=all`.
 */
const getApprovalQueue = async (req, res) => {
    try {
        const { status, projectId, leadId, scope } = req.query;
        const data = await leaveService.getApprovalQueue(req.user, {
            status: status || null,
            projectId: projectId || null,
            leadId: leadId || null,
            scope: scope || null,
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get approval queue");
    }
};

const getLeaveRequest = async (req, res) => {
    try {
        const data = await leaveService.getLeaveRequest(
            req.params.leaveRequestId,
            req.user,
        );
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get leave request");
    }
};

const approveLeaveRequest = async (req, res) => {
    try {
        const data = await leaveService.approveLeaveRequest(
            req.params.leaveRequestId,
            req.user,
            { approvalNotes: req.body?.approvalNotes || null, ...meta(req) },
        );
        res.status(200).json({
            success: true,
            message: "Leave request approved.",
            data,
        });
    } catch (error) {
        respondWithError(res, error, "Approve leave request");
    }
};

const rejectLeaveRequest = async (req, res) => {
    try {
        const data = await leaveService.rejectLeaveRequest(
            req.params.leaveRequestId,
            req.user,
            { rejectionReason: req.body?.rejectionReason, ...meta(req) },
        );
        res.status(200).json({
            success: true,
            message: "Leave request rejected.",
            data,
        });
    } catch (error) {
        respondWithError(res, error, "Reject leave request");
    }
};

const cancelLeaveRequest = async (req, res) => {
    try {
        const data = await leaveService.cancelLeaveRequest(
            req.params.leaveRequestId,
            req.user,
            meta(req),
        );
        res.status(200).json({
            success: true,
            message: "Leave request cancelled.",
            data,
        });
    } catch (error) {
        respondWithError(res, error, "Cancel leave request");
    }
};

const updateLeaveRequest = async (req, res) => {
    try {
        const { leaveType, startDate, endDate, reason, projectId } = req.body ?? {};
        const data = await leaveService.updateLeaveRequest(
            req.params.leaveRequestId,
            req.user,
            { leaveType, startDate, endDate, reason, projectId, ...meta(req) },
        );
        res.status(200).json({
            success: true,
            message: "Leave request updated.",
            data,
        });
    } catch (error) {
        respondWithError(res, error, "Update leave request");
    }
};

const deleteLeaveRequest = async (req, res) => {
    try {
        const data = await leaveService.deleteLeaveRequest(
            req.params.leaveRequestId,
            req.user,
            meta(req),
        );
        res.status(200).json({
            success: true,
            message: "Leave request deleted.",
            data,
        });
    } catch (error) {
        respondWithError(res, error, "Delete leave request");
    }
};

module.exports = {
    createLeaveRequest,
    getMyLeaveRequests,
    getApprovalQueue,
    getLeaveRequest,
    approveLeaveRequest,
    rejectLeaveRequest,
    cancelLeaveRequest,
    updateLeaveRequest,
    deleteLeaveRequest,
};
