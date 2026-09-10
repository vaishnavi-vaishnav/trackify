const attendanceService = require("../services/attendance.service");
const attendanceModel = require("../models/attendance.model");
const { AppError, respondWithError } = require("../utils/AppError");
const { todayISO } = require("../utils/dates");

const getTodayAttendance = async (req, res) => {
    try {
        res.status(200).json(
            await attendanceService.getTodayAttendance(req.user.id),
        );
    } catch (error) {
        respondWithError(res, error, "Get today's attendance");
    }
};

const getAttendanceHistory = async (req, res) => {
    try {
        const { startDate, endDate, projectId } = req.query;
        res.status(200).json(
            await attendanceService.getAttendanceHistory(req.user.id, {
                startDate: startDate || null,
                endDate: endDate || null,
                projectId: projectId || null,
            }),
        );
    } catch (error) {
        respondWithError(res, error, "Get attendance history");
    }
};

/** The caller's own month: records, totals and the weekly breakdown. */
const getMySummary = async (req, res) => {
    try {
        const { month, startDate, endDate, projectId } = req.query;
        const data = await attendanceService.getEmployeeSummary(req.user.id, {
            month: month || null,
            startDate: startDate || null,
            endDate: endDate || null,
            projectId: projectId || null,
        });
        res.status(200).json({ success: true, data });
    } catch (error) {
        respondWithError(res, error, "Get attendance summary");
    }
};

/**
 * One day's attendance for a lead's team. A lead always sees their own team;
 * an admin may pass `leadId` to look at any team.
 */
const getTeamAttendance = async (req, res) => {
    try {
        const { workDate, projectId, leadId } = req.query;

        let targetLeadId = req.user.id;
        if (leadId && Number(leadId) !== req.user.id) {
            if (req.user.role !== "admin") {
                throw new AppError("You can only view your own team.", 403);
            }
            targetLeadId = Number(leadId);
        }

        const data = await attendanceModel.getTeamAttendanceForDate(
            targetLeadId,
            workDate || todayISO(),
            projectId || null,
        );

        res.status(200).json({
            success: true,
            data,
            meta: { workDate: workDate || todayISO(), leadId: targetLeadId },
        });
    } catch (error) {
        respondWithError(res, error, "Get team attendance");
    }
};

module.exports = {
    getTodayAttendance,
    getAttendanceHistory,
    getMySummary,
    getTeamAttendance,
};
