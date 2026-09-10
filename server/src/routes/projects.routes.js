const express = require("express");

const router = express.Router();

const projectController = require("../controllers/project.controller");
const authenticate = require("../middleware/auth.middleware");
const adminOnly = require("../middleware/admin.middleware");

router.use(authenticate);

// Readable by anyone signed in — employees pick a project when marking a day
// or requesting leave.
router.get("/", projectController.getAllProjects);
router.get("/:projectId", projectController.getProjectById);
router.get("/:projectId/leads", projectController.getProjectLeads);
router.get("/:projectId/departments", projectController.getProjectDepartments);

// Structural changes are the admin's.
router.post("/", adminOnly, projectController.createProject);
router.put("/:projectId", adminOnly, projectController.updateProject);
router.delete("/:projectId", adminOnly, projectController.deleteProject);

router.post("/:projectId/leads", adminOnly, projectController.assignLeadToProject);
router.delete(
    "/:projectId/leads/:leadId",
    adminOnly,
    projectController.removeLeadFromProject,
);

router.post(
    "/:projectId/departments",
    adminOnly,
    projectController.createDepartment,
);
router.put(
    "/:projectId/departments/:departmentId",
    adminOnly,
    projectController.updateDepartment,
);
router.delete(
    "/:projectId/departments/:departmentId",
    adminOnly,
    projectController.deleteDepartment,
);

module.exports = router;
