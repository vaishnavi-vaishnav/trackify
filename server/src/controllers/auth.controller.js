const authService = require("../services/auth.service");
const leadModel = require("../models/lead.model");
const userModel = require("../models/user.model");

const sendActivationLink = async (req, res) => {
    try {
        const result = await authService.sendActivationLink(req.body.employeeId);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const activateAccount = async (req, res) => {
    try {
        const result = await authService.activateAccount(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(400).json({ success: false, message: error.message });
    }
};

const login = async (req, res) => {
    try {
        const result = await authService.login(req.body);
        res.status(200).json(result);
    } catch (error) {
        res.status(401).json({ success: false, message: error.message });
    }
};

/**
 * The signed-in account as the server currently sees it. The client caches the
 * user at login, so this is how it picks up a role change or a new lead
 * assignment without making the person sign out and back in.
 */
const getCurrentUser = async (req, res) => {
    try {
        const projects =
            req.user.role === "lead"
                ? await leadModel.getLeadProjects(req.user.id)
                : [];

        // Who this person's leave goes to. An employee cannot read the leads
        // directory, so the name is resolved here — it lets the leave screen
        // say "goes to Priya Nair" instead of a vague "goes to your lead".
        let approver = null;
        if (req.user.role === "employee" && req.user.leadId) {
            const lead = await userModel.findById(req.user.leadId);
            if (lead) {
                approver = {
                    id: lead.id,
                    firstName: lead.first_name,
                    lastName: lead.last_name,
                    role: lead.role,
                };
            }
        }

        res.status(200).json({
            success: true,
            user: { ...req.user, projects, approver },
        });
    } catch (error) {
        console.error("Get current user failed:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
};

module.exports = {
    sendActivationLink,
    activateAccount,
    login,
    getCurrentUser,
};
