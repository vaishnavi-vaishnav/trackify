const adminModel = require("../models/admin.model");
const userModel = require("../models/user.model");
const auditLogModel = require("../models/auditLog.model");
const { AppError } = require("../utils/AppError");
const { splitCount } = require("../utils/pagination");

/**
 * Admin-side account management. One directory covers every role — an
 * "employee" here is any account, and `role` decides whether it behaves as an
 * admin, a lead, or a reporting employee.
 */

const getDashboardStatistics = async () => {
    const stats = await adminModel.getDashboardStatistics();

    // Nobody is ever "not recorded" now: everyone has a status every working
    // day, the office by default, so the headcount is fully accounted for.
    return {
        success: true,
        data: {
            totalEmployees: Number(stats.total_employees),
            totalLeads: Number(stats.total_leads),
            totalProjects: Number(stats.total_projects),
            pendingActivations: Number(stats.pending_activations),
            pendingLeave: Number(stats.pending_leave),
            headcountToday: Number(stats.headcount_today),
            workingToday: Number(stats.working_today),
            wfoToday: Number(stats.wfo_today),
            wfhToday: Number(stats.wfh_today),
            onLeaveToday: Number(stats.on_leave_today),
            flybackToday: Number(stats.flyback_today),
        },
    };
};

/**
 * The paged directory plus the whole-directory counts the filter chips show.
 * The counts deliberately ignore the current filters and page — a chip reading
 * "Leads 4" should keep saying 4 while you are looking at the employees tab.
 */
const getEmployees = async ({ page, pageSize, ...filters } = {}) => {
    const [rows, counts] = await Promise.all([
        userModel.listUsers(filters),
        userModel.getDirectoryCounts(),
    ]);

    const { data, meta } = splitCount(rows, { page, pageSize });
    return { success: true, data, meta: { ...meta, counts } };
};

const getEmployeeByEmployeeId = async (employeeId) => {
    const employee = await userModel.getUserByEmployeeId(employeeId);
    if (!employee) {
        throw new AppError("Employee not found.", 404);
    }
    return { success: true, data: employee };
};

/**
 * Work out the lead an account should end up reporting to.
 *
 * Three cases have to stay distinct, which is why this returns a `clearLead`
 * flag rather than just an id: the caller omitted `leadId` entirely (keep
 * whatever is there), sent an empty value (detach), or sent an id (attach).
 * A form posting `leadId: ""` for "no lead" must detach, not be read as "no
 * opinion" — hence the empty string counts as an explicit clear.
 *
 * Only employees report to a lead, and that lead must actually be one:
 * otherwise an admin could point someone at an arbitrary user id and build a
 * reporting line the approval queues cannot route through.
 */
const resolveLeadAssignment = async ({ role, leadId }) => {
    const omitted = leadId === undefined;
    const cleared = leadId === null || leadId === "";

    // Leads and admins never report to anyone.
    if (role && role !== "employee") {
        if (!omitted && !cleared) {
            throw new AppError(
                "Only employees report to a lead. Leads and admins cannot be assigned one.",
                400,
            );
        }
        return { leadId: null, clearLead: true };
    }

    if (omitted) return { leadId: null, clearLead: false };
    if (cleared) return { leadId: null, clearLead: true };

    const lead = await userModel.findById(leadId);
    if (!lead || lead.role !== "lead") {
        throw new AppError("The selected lead does not exist.", 400);
    }

    return { leadId: lead.id, clearLead: false };
};

const createEmployee = async (employeeData, actor = null, meta = {}) => {
    const role = employeeData.role || "employee";
    if (!userModel.ROLES.includes(role)) {
        throw new AppError(
            `Invalid role. Expected one of: ${userModel.ROLES.join(", ")}.`,
            400,
        );
    }

    if (await userModel.findByEmployeeId(employeeData.employeeId)) {
        throw new AppError("Employee ID already exists.", 409);
    }
    if (await userModel.findByEmail(employeeData.email)) {
        throw new AppError("Email already exists.", 409);
    }

    const { leadId } = await resolveLeadAssignment({
        role,
        leadId: employeeData.leadId,
    });

    const employee = await userModel.createUser({ ...employeeData, role, leadId });

    await auditLogModel.createAuditLog({
        userId: actor?.id ?? null,
        action: "CREATE_USER",
        entityType: "users",
        entityId: employee.id,
        changes: {
            employee_id: employee.employee_id,
            email: employee.email,
            role,
            lead_id: leadId,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
    });

    return {
        success: true,
        message: "Employee created successfully.",
        data: employee,
    };
};

const updateEmployee = async (employeeId, employeeData, actor = null, meta = {}) => {
    const current = await userModel.findByEmployeeId(employeeId);
    if (!current) {
        throw new AppError("Employee not found.", 404);
    }

    const role = employeeData.role;
    if (role && !userModel.ROLES.includes(role)) {
        throw new AppError(
            `Invalid role. Expected one of: ${userModel.ROLES.join(", ")}.`,
            400,
        );
    }

    // Demoting a lead who still has reports would strand those employees with a
    // lead_id pointing at someone who can no longer approve their leave.
    if (current.role === "lead" && role && role !== "lead") {
        const reports = await userModel.countDirectReports(current.id);
        if (reports > 0) {
            throw new AppError(
                `This lead still has ${reports} employee(s) reporting to them. Reassign the team before changing the role.`,
                409,
            );
        }
    }

    if (employeeData.email && employeeData.email !== current.email) {
        const clash = await userModel.findByEmail(employeeData.email);
        if (clash && clash.id !== current.id) {
            throw new AppError("Email already exists.", 409);
        }
    }

    const effectiveRole = role ?? current.role;
    const { leadId, clearLead } = await resolveLeadAssignment({
        role: effectiveRole,
        leadId: employeeData.leadId,
    });

    const employee = await userModel.updateUser(employeeId, {
        ...employeeData,
        role,
        leadId,
        clearLead,
    });

    await auditLogModel.createAuditLog({
        userId: actor?.id ?? null,
        action: "UPDATE_USER",
        entityType: "users",
        entityId: employee.id,
        changes: {
            employee_id: employeeId,
            role: role ?? null,
            lead_id: leadId,
            email: employeeData.email ?? null,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
    });

    return {
        success: true,
        message: "Employee updated successfully.",
        data: employee,
    };
};

/**
 * Remove an account. Blocked for the last admin and for a lead who still has a
 * team, both of which would leave the system without a working approval path.
 */
const deleteEmployee = async (employeeId, actor, meta = {}) => {
    const current = await userModel.findByEmployeeId(employeeId);
    if (!current) {
        throw new AppError("Employee not found.", 404);
    }
    if (current.id === actor.id) {
        throw new AppError("You cannot delete your own account.", 400);
    }

    if (current.role === "admin") {
        const { admins } = await userModel.getDirectoryCounts();
        if (admins <= 1) {
            throw new AppError("The last admin account cannot be deleted.", 409);
        }
    }

    if (current.role === "lead") {
        const reports = await userModel.countDirectReports(current.id);
        if (reports > 0) {
            throw new AppError(
                `This lead still has ${reports} employee(s) reporting to them. Reassign the team first.`,
                409,
            );
        }
    }

    const removed = await userModel.deleteUser(employeeId);

    await auditLogModel.createAuditLog({
        userId: actor.id,
        action: "DELETE_USER",
        entityType: "users",
        entityId: removed.id,
        changes: {
            employee_id: removed.employee_id,
            name: `${removed.first_name} ${removed.last_name}`,
            role: removed.role,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
    });

    return { success: true, message: "Employee deleted successfully.", data: removed };
};

const toggleEmployeeStatus = async (employeeId, actor = null, meta = {}) => {
    const current = await userModel.findByEmployeeId(employeeId);
    if (!current) {
        throw new AppError("Employee not found.", 404);
    }

    // Pending accounts activate themselves by setting a password; flipping one
    // active without one would leave an account nobody can sign in to.
    if (current.account_status === "pending") {
        throw new AppError(
            "Pending employees must activate their own account.",
            409,
        );
    }
    if (current.id === actor?.id) {
        throw new AppError("You cannot deactivate your own account.", 400);
    }

    const employee = await userModel.toggleUserStatus(employeeId);

    await auditLogModel.createAuditLog({
        userId: actor?.id ?? null,
        action: "TOGGLE_USER_STATUS",
        entityType: "users",
        entityId: current.id,
        changes: {
            employee_id: employeeId,
            from: current.account_status,
            to: employee.account_status,
        },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
    });

    return {
        success: true,
        message:
            employee.account_status === "active"
                ? "Employee activated successfully."
                : "Employee deactivated successfully.",
        data: employee,
    };
};

module.exports = {
    getDashboardStatistics,
    getEmployees,
    getEmployeeByEmployeeId,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    toggleEmployeeStatus,
};
