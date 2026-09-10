import api from "./api";

/**
 * Admin account management. One directory holds every account; `role` decides
 * whether it behaves as an admin, a lead, or a reporting employee.
 */

export async function getNextEmployeeId() {
  const { data } = await api.get("/admin/next-employee-id");
  return data.data.employeeId;
}

export async function getDashboardStats() {
  const { data } = await api.get("/admin/dashboard");
  return data;
}

/**
 * The paged directory. `filters` may carry `role`, `status`, `search`,
 * `leadId`, `unassigned`, `page` and `pageSize`.
 *
 * Returns `{ data, meta }` where `meta` carries the paging plus `counts` —
 * whole-directory totals per role and status, which stay stable as you filter.
 */
export async function getEmployees(filters = {}) {
  const { data } = await api.get("/admin/employees", { params: filters });
  return { data: data.data, meta: data.meta };
}

export async function getEmployee(employeeId) {
  const { data } = await api.get(`/admin/employees/${employeeId}`);
  return data;
}

export async function createEmployee(payload) {
  const { data } = await api.post("/admin/employees", payload);
  return data;
}

export async function updateEmployee(employeeId, payload) {
  const { data } = await api.put(`/admin/employees/${employeeId}`, payload);
  return data;
}

export async function deleteEmployee(employeeId) {
  const { data } = await api.delete(`/admin/employees/${employeeId}`);
  return data;
}

export async function toggleEmployeeStatus(employeeId) {
  const { data } = await api.patch(`/admin/employees/${employeeId}/status`);
  return data;
}
