import api from "./api";

/**
 * Day statuses. Everything here reads.
 *
 * A working day is "office" unless an approved request moved it, so there is
 * nothing to check in to and no day to mark: an exception is created by
 * raising a request (see services/leave.js) and applied when it is approved.
 */

/** The signed-in person's day: the office default, or the approved exception. */
export async function getTodayAttendance() {
  const { data } = await api.get("/attendance/today");
  return data;
}

/** Every working day in the range with the status it carries. */
export async function getAttendanceHistory(params = {}) {
  const { data } = await api.get("/attendance/history", { params });
  return data;
}

/** The signed-in user's own month: day list, totals and weekly buckets. */
export async function getMySummary(params = {}) {
  const { data } = await api.get("/attendance/me/summary", { params });
  return data;
}

/** One day across a lead's team. Admins may pass `leadId` for any team. */
export async function getTeamAttendance(params = {}) {
  const { data } = await api.get("/attendance/team", { params });
  return data;
}
