const reportService = require("../services/report.service");
const { respondWithError } = require("../utils/AppError");

/** Shared query filters: a month (or explicit range) plus optional scoping. */
const filters = (req) => ({
    month: req.query.month || null,
    startDate: req.query.startDate || null,
    endDate: req.query.endDate || null,
    projectId: req.query.projectId || null,
    leadId: req.query.leadId || null,
    employeeId: req.query.employeeId || null,
});

const getOverview = async (req, res) => {
    try {
        const data = await reportService.getOverview(req.user, filters(req));
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get overview report");
    }
};

const getEmployeeBreakdown = async (req, res) => {
    try {
        const data = await reportService.getEmployeeBreakdown(
            req.user,
            filters(req),
        );
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get employee report");
    }
};

const getLeadBreakdown = async (req, res) => {
    try {
        const data = await reportService.getLeadBreakdown(req.user, filters(req));
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get lead report");
    }
};

const getProjectBreakdown = async (req, res) => {
    try {
        const data = await reportService.getProjectBreakdown(
            req.user,
            filters(req),
        );
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get project report");
    }
};

const getEmployeeDetail = async (req, res) => {
    try {
        const data = await reportService.getEmployeeDetail(
            req.user,
            Number(req.params.employeeUserId),
            filters(req),
        );
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get employee detail report");
    }
};

const getDailyTrend = async (req, res) => {
    try {
        const data = await reportService.getDailyTrend(req.user, filters(req));
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get daily trend report");
    }
};

const getMyWeek = async (req, res) => {
    try {
        const data = await reportService.getMyWeek(req.user, {
            date: req.query.date || undefined,
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get weekly report");
    }
};

module.exports = {
    getOverview,
    getEmployeeBreakdown,
    getLeadBreakdown,
    getProjectBreakdown,
    getEmployeeDetail,
    getDailyTrend,
    getMyWeek,
};
