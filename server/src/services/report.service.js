const attendanceModel = require("../models/attendance.model");
const leadModel = require("../models/lead.model");
const userModel = require("../models/user.model");
const leaveModel = require("../models/leave.model");
const { AppError } = require("../utils/AppError");
const { monthRange, weekRange, todayISO } = require("../utils/dates");

/**
 * Reporting reads for the dashboards: per-employee, per-lead and per-project
 * status breakdowns over a month (or an explicit date range).
 *
 * Every read is scoped to what the caller may see. Rather than trusting the
 * `leadId` / `employeeId` a client sends, the scope is *derived* from the
 * actor's role: a lead's requests are pinned to their own team, an employee's
 * to themselves, and only an admin's filters are taken at face value.
 */

const resolveRange = ({ month, startDate, endDate }) =>
    startDate && endDate
        ? { month: null, startDate, endDate }
        : monthRange(month);

const {
    toNumericRow: numeric,
    toNumericRows: toNumbers,
} = require("../utils/breakdown");

/**
 * Narrow the requested filters to what `actor` is entitled to.
 * A lead asking for another lead's team is refused rather than quietly
 * re-scoped, so the UI can surface a real error instead of wrong data.
 */
const scopeFor = async (actor, { leadId = null, employeeId = null, projectId = null }) => {
    if (actor.role === "admin") {
        return { leadId, employeeId, projectId };
    }

    if (actor.role === "lead") {
        if (leadId && Number(leadId) !== actor.id) {
            throw new AppError("You can only report on your own team.", 403);
        }
        if (employeeId) {
            const own = await leadModel.isDirectReport(actor.id, employeeId);
            if (!own && Number(employeeId) !== actor.id) {
                throw new AppError(
                    "That employee does not report to you.",
                    403,
                );
            }
            return { leadId: null, employeeId, projectId };
        }
        return { leadId: actor.id, employeeId: null, projectId };
    }

    // Employees only ever see themselves.
    if (employeeId && Number(employeeId) !== actor.id) {
        throw new AppError("You can only view your own attendance.", 403);
    }
    return { leadId: null, employeeId: actor.id, projectId: null };
};

/** Per-employee status breakdown — the main dashboard table. */
const getEmployeeBreakdown = async (actor, filters = {}) => {
    const range = resolveRange(filters);
    const scope = await scopeFor(actor, filters);

    const rows = await attendanceModel.getSummaryByEmployee({
        startDate: range.startDate,
        endDate: range.endDate,
        leadId: scope.leadId,
        employeeId: scope.employeeId,
        projectId: scope.projectId,
        includeLeads: actor.role === "admin",
    });

    return { range, employees: toNumbers(rows) };
};

/** Per-lead rollup. Admin-only: a lead has no view across other leads. */
const getLeadBreakdown = async (actor, filters = {}) => {
    if (actor.role !== "admin") {
        throw new AppError("Only an admin can view the lead-wise report.", 403);
    }

    const range = resolveRange(filters);
    const rows = await attendanceModel.getSummaryByLead(
        range.startDate,
        range.endDate,
        filters.projectId ?? null,
    );

    return { range, leads: toNumbers(rows) };
};

/** Per-project rollup. Admin-only, for the same reason. */
const getProjectBreakdown = async (actor, filters = {}) => {
    if (actor.role !== "admin") {
        throw new AppError("Only an admin can view the project-wise report.", 403);
    }

    const range = resolveRange(filters);
    const rows = await attendanceModel.getSummaryByProject(
        range.startDate,
        range.endDate,
    );

    return { range, projects: toNumbers(rows) };
};

/**
 * One person's month: their day-by-day records, the month's totals, and the
 * same totals bucketed by week.
 */
const getEmployeeDetail = async (actor, employeeUserId, filters = {}) => {
    const range = resolveRange(filters);
    await scopeFor(actor, { ...filters, employeeId: employeeUserId });

    const employee = await userModel.findById(employeeUserId);
    if (!employee) {
        throw new AppError("Employee not found.", 404);
    }

    const [records, summaryRows, weekly, leave] = await Promise.all([
        attendanceModel.getAttendanceHistory(employeeUserId, {
            startDate: range.startDate,
            endDate: range.endDate,
            projectId: filters.projectId ?? null,
        }),
        attendanceModel.getSummaryByEmployee({
            startDate: range.startDate,
            endDate: range.endDate,
            employeeId: employeeUserId,
        }),
        attendanceModel.getWeeklySummary(
            employeeUserId,
            range.startDate,
            range.endDate,
        ),
        leaveModel.getLeaveRequestsForUser(employeeUserId),
    ]);

    return {
        range,
        employee: {
            id: employee.id,
            employeeId: employee.employee_id,
            firstName: employee.first_name,
            lastName: employee.last_name,
            email: employee.email,
            department: employee.department,
            designation: employee.designation,
            role: employee.role,
            leadId: employee.lead_id,
        },
        records,
        summary: numeric(summaryRows[0] ?? null),
        weekly: toNumbers(weekly),
        leaveRequests: leave,
    };
};

/** This week's per-day totals for the caller's own record. */
const getMyWeek = async (actor, { date = todayISO() } = {}) => {
    const range = weekRange(date);
    const [records, weekly] = await Promise.all([
        attendanceModel.getAttendanceHistory(actor.id, {
            startDate: range.startDate,
            endDate: range.endDate,
        }),
        attendanceModel.getWeeklySummary(actor.id, range.startDate, range.endDate),
    ]);

    return { range, records, weekly: toNumbers(weekly) };
};

/**
 * Day-by-day totals over a month (or explicit range), for the daily trend on
 * each dashboard. Scoped like every other report: an employee gets their own
 * days, a lead their team's, an admin the whole organisation's.
 */
const getDailyTrend = async (actor, filters = {}) => {
    const range = resolveRange(filters);
    const scope = await scopeFor(actor, filters);

    const days = await attendanceModel.getDailySummary({
        startDate: range.startDate,
        endDate: range.endDate,
        leadId: scope.leadId,
        employeeId: scope.employeeId,
        projectId: scope.projectId,
        // A request pinned to one person is about that person whatever their
        // role — without this a lead reading their own trend would filter
        // themselves out. The role filter only shapes the wider rollups,
        // where a lead's own days would otherwise double-count against the
        // team they report on.
        includeLeads: actor.role === "admin" || Boolean(scope.employeeId),
    });

    return { range, days: toNumbers(days) };
};

/** Headline numbers for a dashboard: today's shape plus the month's totals. */
const getOverview = async (actor, filters = {}) => {
    const range = resolveRange(filters);
    const scope = await scopeFor(actor, filters);

    const [today, employees] = await Promise.all([
        attendanceModel.getDayStatusCounts(todayISO()),
        attendanceModel.getSummaryByEmployee({
            startDate: range.startDate,
            endDate: range.endDate,
            leadId: scope.leadId,
            employeeId: scope.employeeId,
            projectId: scope.projectId,
            includeLeads: actor.role === "admin",
        }),
    ]);

    const rows = toNumbers(employees);
    const totals = rows.reduce(
        (acc, row) => {
            acc.wfo += row.wfo;
            acc.wfh += row.wfh;
            acc.on_leave += row.on_leave;
            acc.flyback += row.flyback;
            acc.days_recorded += row.days_recorded;
            return acc;
        },
        { wfo: 0, wfh: 0, on_leave: 0, flyback: 0, days_recorded: 0 },
    );

    return {
        range,
        headcount: rows.length,
        today: numeric(today, [
            "wfo",
            "wfh",
            "on_leave",
            "flyback",
            "headcount",
        ]),
        totals,
    };
};

module.exports = {
    getEmployeeBreakdown,
    getLeadBreakdown,
    getProjectBreakdown,
    getEmployeeDetail,
    getMyWeek,
    getDailyTrend,
    getOverview,
};
