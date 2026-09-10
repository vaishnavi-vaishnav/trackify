import api from "./api";

/**
 * Attendance reporting. Every call is scoped server-side to what the caller
 * may see — a lead's request comes back covering only their own team — so the
 * same function serves each role's dashboard.
 *
 * `filters` accepts `month` ("YYYY-MM"), or an explicit `startDate`/`endDate`,
 * plus optional `projectId`, `leadId` and `employeeId`.
 */

export async function getOverview(filters = {}) {
  const { data } = await api.get("/reports/overview", { params: filters });
  return data.data;
}

/** Per-employee status breakdown: the main dashboard table. */
export async function getEmployeeBreakdown(filters = {}) {
  const { data } = await api.get("/reports/employees", { params: filters });
  return data.data;
}

/** Per-lead rollup (admin only). */
export async function getLeadBreakdown(filters = {}) {
  const { data } = await api.get("/reports/leads", { params: filters });
  return data.data;
}

/** Per-project rollup (admin only). */
export async function getProjectBreakdown(filters = {}) {
  const { data } = await api.get("/reports/projects", { params: filters });
  return data.data;
}

/** One person's month: records, totals, weekly buckets and leave history. */
export async function getEmployeeDetail(employeeUserId, filters = {}) {
  const { data } = await api.get(`/reports/employees/${employeeUserId}`, {
    params: filters,
  });
  return data.data;
}

/**
 * Day-by-day totals over a month, scoped to the caller: an employee's own
 * days, a lead's team, an admin's organisation. Only dates with records come
 * back — `buildDailySeries` fills in the rest.
 */
export async function getDailyTrend(filters = {}) {
  const { data } = await api.get("/reports/daily", { params: filters });
  return data.data;
}

/** The caller's own current week. */
export async function getMyWeek(date = null) {
  const { data } = await api.get("/reports/my-week", {
    params: date ? { date } : {},
  });
  return data.data;
}
