const express = require("express");

const router = express.Router();

const attendanceController = require("../controllers/attendance.controller");
const authenticate = require("../middleware/auth.middleware");
const { leadOrAdmin } = require("../middleware/lead.middleware");

router.use(authenticate);

// Everything here reads. A day only moves off the office default through an
// approved request, which the leave routes own — there is nothing to check in
// to and no day to mark by hand.
router.get("/today", attendanceController.getTodayAttendance);

// Own history and month/week summary.
router.get("/history", attendanceController.getAttendanceHistory);
router.get("/me/summary", attendanceController.getMySummary);

// One day across a lead's team.
router.get("/team", leadOrAdmin, attendanceController.getTeamAttendance);

module.exports = router;
