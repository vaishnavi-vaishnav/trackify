const express = require("express");

const router = express.Router();

const adminController = require("../controllers/admin.controller");
const authenticate = require("../middleware/auth.middleware");
const adminOnly = require("../middleware/admin.middleware");
const validate = require("../middleware/validation.middleware");
const {
    createEmployeeValidation,
    updateEmployeeValidation,
} = require("../validations/admin.validation");

router.use(authenticate, adminOnly);

router.get("/next-employee-id", adminController.getNextEmployeeId);
router.get("/dashboard", adminController.getDashboardStatistics);

// One directory for every account; `?role=` narrows it to employees, leads or
// admins.
router.get("/employees", adminController.getEmployees);
router.post(
    "/employees",
    createEmployeeValidation,
    validate,
    adminController.createEmployee,
);

router.get("/employees/:employeeId", adminController.getEmployeeByEmployeeId);
router.put(
    "/employees/:employeeId",
    updateEmployeeValidation,
    validate,
    adminController.updateEmployee,
);
router.delete("/employees/:employeeId", adminController.deleteEmployee);
router.patch(
    "/employees/:employeeId/status",
    adminController.toggleEmployeeStatus,
);

module.exports = router;
