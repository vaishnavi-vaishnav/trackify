const jwt = require("jsonwebtoken");
const userModel = require("../models/user.model");

/**
 * Verify the bearer token and attach the caller to `req.user`.
 *
 * The account is re-read on every request rather than trusted from the token's
 * claims. Roles and reporting lines change while a token is still valid, and
 * every authorization decision downstream (who may approve a leave, whose team
 * a report covers) keys off them — a stale `role` in an 8-hour-old token would
 * silently grant access the admin has already revoked.
 *
 * `token_version` is the revocation lever: deactivating an account bumps it,
 * which invalidates tokens minted before the change.
 */
const authenticate = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Access token is required.",
        });
    }

    let decoded;
    try {
        decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET);
    } catch {
        return res.status(401).json({
            success: false,
            message: "Invalid or expired token.",
        });
    }

    try {
        const user = await userModel.findById(decoded.id);

        if (!user || user.account_status !== "active") {
            return res.status(401).json({
                success: false,
                message: "This account is no longer active.",
            });
        }

        if ((decoded.tokenVersion ?? 0) !== user.token_version) {
            return res.status(401).json({
                success: false,
                message: "Your session has expired. Please sign in again.",
            });
        }

        req.user = {
            id: user.id,
            employeeId: user.employee_id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            role: user.role,
            leadId: user.lead_id,
        };

        return next();
    } catch (error) {
        console.error("Authentication lookup failed:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

module.exports = authenticate;
