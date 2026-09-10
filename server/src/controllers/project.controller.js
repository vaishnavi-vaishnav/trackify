const projectModel = require("../models/project.model");
const userModel = require("../models/user.model");
const auditLogModel = require("../models/auditLog.model");
const { AppError, respondWithError } = require("../utils/AppError");
const { parsePagination, splitCount } = require("../utils/pagination");

const PROJECT_STATUSES = ["active", "archived"];

const audit = (req, action, entityId, changes, entityType = "project") =>
    auditLogModel.createAuditLog({
        userId: req.user.id,
        action,
        entityType,
        entityId,
        changes,
        ipAddress: req.ip,
        userAgent: req.get("user-agent"),
    });

const requireProject = async (projectId) => {
    const project = await projectModel.getProjectById(projectId);
    if (!project) {
        throw new AppError("Project not found.", 404);
    }
    return project;
};

const createProject = async (req, res) => {
    try {
        const { name, description, status } = req.body ?? {};

        if (!name?.trim()) {
            throw new AppError("A project name is required.", 400);
        }
        if (status && !PROJECT_STATUSES.includes(status)) {
            throw new AppError("Status must be 'active' or 'archived'.", 400);
        }
        if (await projectModel.findProjectByName(name.trim())) {
            throw new AppError("A project with that name already exists.", 409);
        }

        const project = await projectModel.createProject({
            name: name.trim(),
            description: description?.trim() || null,
            status: status || "active",
        });

        await audit(req, "CREATE_PROJECT", project.id, {
            name: project.name,
            status: project.status,
        });

        res.status(201).json({ success: true, data: project });
    } catch (error) {
        respondWithError(res, error, "Create project");
    }
};

const getAllProjects = async (req, res) => {
    try {
        const { page, pageSize, limit, offset } = parsePagination(req.query, {
            defaultPageSize: 24,
        });

        const [rows, counts] = await Promise.all([
            projectModel.getAllProjects({
                activeOnly: req.query.activeOnly === "true",
                status: req.query.status || null,
                search: req.query.search?.trim() || null,
                limit,
                offset,
            }),
            projectModel.getProjectCounts(),
        ]);

        const { data, meta } = splitCount(rows, { page, pageSize });
        res.status(200).json({ success: true, data, meta: { ...meta, counts } });
    } catch (error) {
        respondWithError(res, error, "List projects");
    }
};

/** A project with everything hanging off it: leads, people, departments. */
const getProjectById = async (req, res) => {
    try {
        const project = await requireProject(req.params.projectId);

        const [leads, employees, departments] = await Promise.all([
            projectModel.getProjectLeads(project.id),
            projectModel.getProjectEmployees(project.id),
            projectModel.getProjectDepartments(project.id),
        ]);

        res.status(200).json({
            success: true,
            data: { ...project, leads, employees, departments },
        });
    } catch (error) {
        respondWithError(res, error, "Get project");
    }
};

const updateProject = async (req, res) => {
    try {
        const { name, description, status } = req.body ?? {};
        const project = await requireProject(req.params.projectId);

        if (status && !PROJECT_STATUSES.includes(status)) {
            throw new AppError("Status must be 'active' or 'archived'.", 400);
        }
        if (name?.trim() && (await projectModel.findProjectByName(name.trim(), project.id))) {
            throw new AppError("A project with that name already exists.", 409);
        }

        const updated = await projectModel.updateProject(project.id, {
            name: name?.trim(),
            description: description?.trim(),
            status,
        });

        await audit(req, "UPDATE_PROJECT", project.id, { name, description, status });

        res.status(200).json({ success: true, data: updated });
    } catch (error) {
        respondWithError(res, error, "Update project");
    }
};

/**
 * Delete a project. Attendance and leave rows reference it with ON DELETE SET
 * NULL, so history survives the project but loses its label — a project that
 * still has recorded work is archived instead, unless `?force=true`.
 */
const deleteProject = async (req, res) => {
    try {
        const project = await requireProject(req.params.projectId);
        const leads = await projectModel.getProjectLeads(project.id);

        if (leads.length > 0 && req.query.force !== "true") {
            throw new AppError(
                `This project still has ${leads.length} lead(s) assigned. Remove them first, or archive the project instead.`,
                409,
            );
        }

        await projectModel.deleteProject(project.id);
        await audit(req, "DELETE_PROJECT", project.id, { name: project.name });

        res.status(200).json({
            success: true,
            message: "Project deleted successfully.",
        });
    } catch (error) {
        respondWithError(res, error, "Delete project");
    }
};

const getProjectLeads = async (req, res) => {
    try {
        await requireProject(req.params.projectId);
        const data = await projectModel.getProjectLeads(req.params.projectId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get project leads");
    }
};

const assignLeadToProject = async (req, res) => {
    try {
        const { leadId, departmentId } = req.body ?? {};
        const project = await requireProject(req.params.projectId);

        if (!leadId) {
            throw new AppError("A lead is required.", 400);
        }

        const lead = await userModel.findById(leadId);
        if (!lead || lead.role !== "lead") {
            throw new AppError("The selected user is not a lead.", 400);
        }

        const assignment = await projectModel.assignLeadToProject(
            project.id,
            lead.id,
            departmentId || null,
        );

        await audit(
            req,
            "ASSIGN_LEAD_TO_PROJECT",
            assignment.id,
            { project_id: project.id, lead_id: lead.id, department_id: departmentId ?? null },
            "project_leads",
        );

        res.status(201).json({ success: true, data: assignment });
    } catch (error) {
        respondWithError(res, error, "Assign lead to project");
    }
};

const removeLeadFromProject = async (req, res) => {
    try {
        const { projectId, leadId } = req.params;
        const removed = await projectModel.removeLeadFromProject(projectId, leadId);

        if (!removed) {
            throw new AppError("That lead is not assigned to this project.", 404);
        }

        await audit(
            req,
            "REMOVE_LEAD_FROM_PROJECT",
            removed.id,
            { project_id: Number(projectId), lead_id: Number(leadId) },
            "project_leads",
        );

        res.status(200).json({
            success: true,
            message: "Lead removed from project.",
        });
    } catch (error) {
        respondWithError(res, error, "Remove lead from project");
    }
};

// --- Departments ------------------------------------------------------------

const getProjectDepartments = async (req, res) => {
    try {
        await requireProject(req.params.projectId);
        const data = await projectModel.getProjectDepartments(req.params.projectId);
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get departments");
    }
};

const createDepartment = async (req, res) => {
    try {
        const project = await requireProject(req.params.projectId);
        const name = req.body?.name?.trim();

        if (!name) {
            throw new AppError("A department name is required.", 400);
        }

        const existing = await projectModel.getProjectDepartments(project.id);
        if (existing.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
            throw new AppError(
                "That department already exists in this project.",
                409,
            );
        }

        const department = await projectModel.createDepartment(project.id, name);
        await audit(
            req,
            "CREATE_DEPARTMENT",
            department.id,
            { project_id: project.id, name },
            "department",
        );

        res.status(201).json({ success: true, data: department });
    } catch (error) {
        respondWithError(res, error, "Create department");
    }
};

const updateDepartment = async (req, res) => {
    try {
        const name = req.body?.name?.trim();
        if (!name) {
            throw new AppError("A department name is required.", 400);
        }

        const department = await projectModel.updateDepartment(
            req.params.departmentId,
            name,
        );
        if (!department) {
            throw new AppError("Department not found.", 404);
        }

        await audit(req, "UPDATE_DEPARTMENT", department.id, { name }, "department");
        res.status(200).json({ success: true, data: department });
    } catch (error) {
        respondWithError(res, error, "Update department");
    }
};

const deleteDepartment = async (req, res) => {
    try {
        const removed = await projectModel.deleteDepartment(req.params.departmentId);
        if (!removed) {
            throw new AppError("Department not found.", 404);
        }

        await audit(
            req,
            "DELETE_DEPARTMENT",
            removed.id,
            { name: removed.name },
            "department",
        );
        res.status(200).json({ success: true, message: "Department deleted." });
    } catch (error) {
        respondWithError(res, error, "Delete department");
    }
};

module.exports = {
    createProject,
    getAllProjects,
    getProjectById,
    updateProject,
    deleteProject,
    getProjectLeads,
    assignLeadToProject,
    removeLeadFromProject,
    getProjectDepartments,
    createDepartment,
    updateDepartment,
    deleteDepartment,
};
