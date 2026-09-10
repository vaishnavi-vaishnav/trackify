const express = require("express");

const router = express.Router();

const reportController = require("../controllers/report.controller");
const authenticate = require("../middleware/auth.middleware");
const { leadOrAdmin } = require("../middleware/lead.middleware");
const adminOnly = require("../middleware/admin.middleware");

router.use(authenticate);

// Every report is scoped to the caller inside the service: an employee only
// ever gets their own numbers, a lead only their team's.
router.get("/overview", reportController.getOverview);
router.get("/my-week", reportController.getMyWeek);
router.get("/daily", reportController.getDailyTrend);

router.get("/employees", leadOrAdmin, reportController.getEmployeeBreakdown);
router.get("/leads", adminOnly, reportController.getLeadBreakdown);
router.get("/projects", adminOnly, reportController.getProjectBreakdown);

router.get("/employees/:employeeUserId", reportController.getEmployeeDetail);

module.exports = router;
