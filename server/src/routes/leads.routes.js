const express = require("express");

const router = express.Router();

const leadController = require("../controllers/lead.controller");
const authenticate = require("../middleware/auth.middleware");
const adminOnly = require("../middleware/admin.middleware");
const { leadOrAdmin } = require("../middleware/lead.middleware");

router.use(authenticate);

// "/unassigned" is declared before "/:leadId" so it is not read as a lead id.
router.get("/unassigned-employees", adminOnly, leadController.getUnassignedEmployees);

router.get("/", leadOrAdmin, leadController.getAllLeads);

// A lead may read their own team; the controller rejects anyone else's.
router.get("/:leadId", leadController.getLeadById);
router.get("/:leadId/employees", leadController.getLeadEmployees);
router.get("/:leadId/projects", leadController.getLeadProjects);

// Reassignment is the admin's.
router.post("/:leadId/employees", adminOnly, leadController.assignEmployeeToLead);
router.delete(
    "/:leadId/employees/:employeeUserId",
    adminOnly,
    leadController.removeEmployeeFromLead,
);

module.exports = router;
