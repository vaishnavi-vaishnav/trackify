const express = require("express");

const router = express.Router();

const authController = require("../controllers/auth.controller");
const authenticate = require("../middleware/auth.middleware");
const validate = require("../middleware/validation.middleware");
const {
    activateValidation,
    loginValidation,
} = require("../validations/auth.validation");

router.post(
    "/send-activation-link",
    authController.sendActivationLink,
);

router.post(
    "/activate",
    activateValidation,
    validate,
    authController.activateAccount,
);

router.post(
    "/login",
    loginValidation,
    validate,
    authController.login,
);

// Re-read the signed-in account so the client can refresh a cached user whose
// role or lead assignment has changed since login.
router.get(
    "/me",
    authenticate,
    authController.getCurrentUser,
);

module.exports = router;
