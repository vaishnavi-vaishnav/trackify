const attendanceModel = require("../models/attendance.model");
const { monthRange, todayISO, eachWorkingDay } = require("../utils/dates");
const { toNumericRow, toNumericRows } = require("../utils/breakdown");

/**
 * Reads over the day statuses.
 *
 * Nothing here writes: a day only ever moves off the office default through an
 * approved request, which the leave service applies. There is no check-in to
 * start, no hours to total, and no day for an employee to mark by hand.
 */

/** Weekends are not working days, so they carry no status at all. */
const isWorkingDay = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    const day = new Date(y, m - 1, d).getDay();
    return day !== 0 && day !== 6;
};

/**
 * What a person's day looks like: the exception on record, or the default.
 */
const getTodayAttendance = async (userId) => {
    const workDate = todayISO();
    const record = await attendanceModel.findAttendanceOn(userId, workDate);

    return {
        success: true,
        data: {
            workDate,
            workingDay: isWorkingDay(workDate),
            status: isWorkingDay(workDate) ? (record?.status ?? "wfo") : null,
            // True when the day is the plain default rather than something
            // that was requested and approved.
            isDefault: !record,
            projectId: record?.project_id ?? null,
            projectName: record?.project_name ?? null,
            leaveRequestId: record?.leave_request_id ?? null,
            notes: record?.notes ?? null,
        },
    };
};

/**
 * Expand a range into one entry per working day, marking each with its
 * exception or the office default. This is the day-by-day view every role
 * reads; the stored rows alone would show only the days somebody was away.
 */
const buildDayList = (records, { startDate, endDate }, { joiningDate = null } = {}) => {
    const today = todayISO();
    const from = joiningDate && joiningDate > startDate ? joiningDate : startDate;
    const to = endDate > today ? today : endDate;
    if (from > to) return [];

    const byDate = new Map(
        records.map((row) => [String(row.work_date).slice(0, 10), row]),
    );

    return eachWorkingDay(from, to)
        .map((iso) => {
            const record = byDate.get(iso);
            return {
                work_date: iso,
                status: record?.status ?? "wfo",
                is_default: !record,
                project_id: record?.project_id ?? null,
                project_name: record?.project_name ?? null,
                leave_request_id: record?.leave_request_id ?? null,
                notes: record?.notes ?? null,
                id: record?.id ?? null,
            };
        })
        .reverse();
};

const getAttendanceHistory = async (userId, options = {}) => {
    const records = await attendanceModel.getAttendanceHistory(userId, options);
    const range =
        options.startDate && options.endDate
            ? { startDate: options.startDate, endDate: options.endDate }
            : monthRange();

    return { success: true, data: buildDayList(records, range) };
};

/**
 * One employee's month: every working day with its status, the month's
 * breakdown, and the same breakdown by week.
 */
const getEmployeeSummary = async (
    userId,
    { month = null, startDate = null, endDate = null, projectId = null } = {},
) => {
    const range =
        startDate && endDate ? { startDate, endDate } : monthRange(month);

    const [records, summaryRows, weekly] = await Promise.all([
        attendanceModel.getAttendanceHistory(userId, {
            projectId,
            startDate: range.startDate,
            endDate: range.endDate,
        }),
        attendanceModel.getSummaryByEmployee({
            startDate: range.startDate,
            endDate: range.endDate,
            employeeId: userId,
        }),
        attendanceModel.getWeeklySummary(userId, range.startDate, range.endDate),
    ]);

    return {
        range,
        records: buildDayList(records, range),
        summary: toNumericRow(summaryRows[0] ?? null),
        weekly: toNumericRows(weekly),
    };
};

module.exports = {
    getTodayAttendance,
    getAttendanceHistory,
    getEmployeeSummary,
    buildDayList,
};
