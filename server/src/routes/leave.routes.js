const express = require("express");

const router = express.Router();

const leaveController = require("../controllers/leave.controller");
const authenticate = require("../middleware/auth.middleware");
const { leadOrAdmin } = require("../middleware/lead.middleware");

router.use(authenticate);

// Literal paths are declared before "/:leaveRequestId" — Express matches in
// order, so a parameter route registered first would swallow "/my-requests"
// and "/queue" and try to look them up as request ids.
router.post("/request", leaveController.createLeaveRequest);
router.get("/my-requests", leaveController.getMyLeaveRequests);
router.get("/queue", leadOrAdmin, leaveController.getApprovalQueue);

router.get("/:leaveRequestId", leaveController.getLeaveRequest);
router.put("/:leaveRequestId", leaveController.updateLeaveRequest);
router.delete("/:leaveRequestId", leaveController.deleteLeaveRequest);

router.post("/:leaveRequestId/approve", leadOrAdmin, leaveController.approveLeaveRequest);
router.post("/:leaveRequestId/reject", leadOrAdmin, leaveController.rejectLeaveRequest);
router.post("/:leaveRequestId/cancel", leaveController.cancelLeaveRequest);

module.exports = router;
