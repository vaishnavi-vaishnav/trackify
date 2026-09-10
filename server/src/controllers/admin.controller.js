const adminService = require("../services/admin.service");
const adminModel = require("../models/admin.model");
const { respondWithError } = require("../utils/AppError");
const { parsePagination } = require("../utils/pagination");

/** Request metadata attached to every audit-log entry. */
const meta = (req) => ({
    ipAddress: req.ip,
    userAgent: req.get("user-agent"),
});

const getNextEmployeeId = async (req, res) => {
    try {
        const employeeId = await adminModel.getNextEmployeeId();
        res.status(200).json({ success: true, data: { employeeId } });
    } catch (error) {
        respondWithError(res, error, "Get next employee id");
    }
};

const getDashboardStatistics = async (req, res) => {
    try {
        res.status(200).json(await adminService.getDashboardStatistics());
    } catch (error) {
        respondWithError(res, error, "Get dashboard statistics");
    }
};

const getEmployees = async (req, res) => {
    try {
        const { role, search, leadId, status, unassigned } = req.query;
        const { page, pageSize, limit, offset } = parsePagination(req.query);

        res.status(200).json(
            await adminService.getEmployees({
                role: role || null,
                search: search?.trim() || null,
                leadId: leadId || null,
                status: status || null,
                unassignedOnly: unassigned === "true",
                page,
                pageSize,
                limit,
                offset,
            }),
        );
    } catch (error) {
        respondWithError(res, error, "List employees");
    }
};

const getEmployeeByEmployeeId = async (req, res) => {
    try {
        res.status(200).json(
            await adminService.getEmployeeByEmployeeId(req.params.employeeId),
        );
    } catch (error) {
        respondWithError(res, error, "Get employee");
    }
};

const createEmployee = async (req, res) => {
    try {
        res.status(201).json(
            await adminService.createEmployee(req.body, req.user, meta(req)),
        );
    } catch (error) {
        respondWithError(res, error, "Create employee");
    }
};

const updateEmployee = async (req, res) => {
    try {
        res.status(200).json(
            await adminService.updateEmployee(
                req.params.employeeId,
                req.body,
                req.user,
                meta(req),
            ),
        );
    } catch (error) {
        respondWithError(res, error, "Update employee");
    }
};

const deleteEmployee = async (req, res) => {
    try {
        res.status(200).json(
            await adminService.deleteEmployee(
                req.params.employeeId,
                req.user,
                meta(req),
            ),
        );
    } catch (error) {
        respondWithError(res, error, "Delete employee");
    }
};

const toggleEmployeeStatus = async (req, res) => {
    try {
        res.status(200).json(
            await adminService.toggleEmployeeStatus(
                req.params.employeeId,
                req.user,
                meta(req),
            ),
        );
    } catch (error) {
        respondWithError(res, error, "Toggle employee status");
    }
};

module.exports = {
    getNextEmployeeId,
    getDashboardStatistics,
    getEmployees,
    getEmployeeByEmployeeId,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeStatus,
};
