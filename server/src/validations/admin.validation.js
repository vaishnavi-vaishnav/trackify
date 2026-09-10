const { body } = require("express-validator");

const PHONE_RE = /^[+\d][\d\s().-]{6,}$/;
const ROLES = ["admin", "lead", "employee"];

const employeeFields = [
    body("firstName")
        .trim()
        .notEmpty()
        .withMessage("First name is required"),

    body("lastName")
        .trim()
        .notEmpty()
        .withMessage("Last name is required"),

    body("email")
        .trim()
        .isEmail()
        .withMessage("Invalid email address"),

    body("phone")
        .optional({ values: "falsy" })
        .custom((value) => PHONE_RE.test(value))
        .withMessage("Invalid phone number"),

    body("department")
        .optional({ values: "falsy" })
        .trim()
        .isLength({ max: 100 })
        .withMessage("Department is too long"),

    body("designation")
        .optional({ values: "falsy" })
        .trim()
        .isLength({ max: 100 })
        .withMessage("Designation is too long"),

    body("joiningDate")
        .optional({ values: "falsy" })
        .isISO8601()
        .withMessage("Joining date must be a valid date"),

    body("role")
        .optional({ values: "falsy" })
        .isIn(ROLES)
        .withMessage(`Role must be one of: ${ROLES.join(", ")}`),

    // An empty leadId means "no lead" and is handled by the service, so only
    // non-empty values are checked for shape here.
    body("leadId")
        .optional({ values: "falsy" })
        .isInt({ min: 1 })
        .withMessage("Invalid lead selection"),
];

/** Create: employeeId is part of the payload. */
const createEmployeeValidation = [
    body("employeeId")
        .trim()
        .notEmpty()
        .withMessage("Employee ID is required")
        .isLength({ min: 3 })
        .withMessage("Employee ID must be at least 3 characters"),
    ...employeeFields,
];

/** Update: employeeId comes from the URL, never from the body. */
const updateEmployeeValidation = employeeFields;

module.exports = {
    createEmployeeValidation,
    updateEmployeeValidation,
};
