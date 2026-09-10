const leadModel = require("../models/lead.model");
const userModel = require("../models/user.model");
const auditLogModel = require("../models/auditLog.model");
const { AppError, respondWithError } = require("../utils/AppError");
const { parsePagination, splitCount } = require("../utils/pagination");

/**
 * A lead may read their own team and projects; an admin may read anyone's.
 * Without this check any authenticated user could walk the org chart by
 * incrementing the id in the URL.
 */
const assertCanViewLead = (actor, leadId) => {
    if (actor.role === "admin") return;
    if (actor.role === "lead" && actor.id === Number(leadId)) return;
    throw new AppError("You do not have access to this team.", 403);
};

const getAllLeads = async (req, res) => {
    try {
        const { page, pageSize, limit, offset } = parsePagination(req.query, {
            defaultPageSize: 24,
        });

        const [rows, counts] = await Promise.all([
            leadModel.getAllLeads({
                search: req.query.search?.trim() || null,
                projectId: req.query.projectId || null,
                limit,
                offset,
            }),
            leadModel.getLeadCounts(),
        ]);

        const { data, meta } = splitCount(rows, { page, pageSize });
        res.status(200).json({ success: true, data, meta: { ...meta, counts } });
    } catch (error) {
        respondWithError(res, error, "List leads");
    }
};

const getLeadById = async (req, res) => {
    try {
        const { leadId } = req.params;
        assertCanViewLead(req.user, leadId);

        const lead = await leadModel.getLeadById(leadId);
        if (!lead) {
            throw new AppError("Lead not found.", 404);
        }

        const [employees, projects] = await Promise.all([
            leadModel.getLeadEmployees(leadId),
            leadModel.getLeadProjects(leadId),
        ]);

        res.status(200).json({
            success: true,
            data: { ...lead, employees, projects },
        });
    } catch (error) {
        respondWithError(res, error, "Get lead");
    }
};

const getLeadEmployees = async (req, res) => {
    try {
        const { leadId } = req.params;
        assertCanViewLead(req.user, leadId);

        const data = await leadModel.getLeadEmployees(
            leadId,
            req.query.projectId || null,
        );
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get lead employees");
    }
};

const getLeadProjects = async (req, res) => {
    try {
        const { leadId } = req.params;
        assertCanViewLead(req.user, leadId);

        const data = await leadModel.getLeadProjects(leadId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get lead projects");
    }
};

/** Employees with no lead — the pool an admin assigns from. */
const getUnassignedEmployees = async (req, res) => {
    try {
        const data = await leadModel.getUnassignedEmployees();
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get unassigned employees");
    }
};

/** Move an employee under a lead. Admin only. */
const assignEmployeeToLead = async (req, res) => {
    try {
        const { leadId } = req.params;
        const { employeeId } = req.body ?? {};

        if (!employeeId) {
            throw new AppError("An employee is required.", 400);
        }

        const lead = await leadModel.getLeadById(leadId);
        if (!lead) {
            throw new AppError("Lead not found.", 404);
        }

        // Accept either the numeric user id or the human-facing employee id.
        const employee =
            (await userModel.findByEmployeeId(String(employeeId))) ??
            (Number.isNaN(Number(employeeId))
                ? null
                : await userModel.findById(Number(employeeId)));

        if (!employee) {
            throw new AppError("Employee not found.", 404);
        }
        if (employee.role !== "employee") {
            throw new AppError(
                "Only employees can be assigned to a lead.",
                400,
            );
        }

        const updated = await leadModel.assignEmployeeToLead(employee.id, lead.id);

        await auditLogModel.createAuditLog({
            userId: req.user.id,
            action: "ASSIGN_EMPLOYEE_TO_LEAD",
            entityType: "users",
            entityId: employee.id,
            changes: {
                employee_id: employee.employee_id,
                from_lead_id: employee.lead_id,
                to_lead_id: lead.id,
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        respondWithError(res, error, "Assign employee to lead");
    }
};

/** Detach an employee from their lead. Admin only. */
const removeEmployeeFromLead = async (req, res) => {
    try {
        const { leadId, employeeUserId } = req.params;

        const employee = await userModel.findById(employeeUserId);
        if (!employee || employee.lead_id !== Number(leadId)) {
            throw new AppError("That employee does not report to this lead.", 404);
        }

        const updated = await leadModel.assignEmployeeToLead(employee.id, null);

        await auditLogModel.createAuditLog({
            userId: req.user.id,
            action: "REMOVE_EMPLOYEE_FROM_LEAD",
            entityType: "users",
            entityId: employee.id,
            changes: {
                employee_id: employee.employee_id,
                from_lead_id: Number(leadId),
            },
            ipAddress: req.ip,
            userAgent: req.get("user-agent"),
        });

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        respondWithError(res, error, "Remove employee from lead");
    }
};

module.exports = {
    getAllLeads,
    getLeadById,
    getLeadEmployees,
    getLeadProjects,
    getUnassignedEmployees,
    assignEmployeeToLead,
    removeEmployeeFromLead,
};
