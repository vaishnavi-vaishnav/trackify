import api from "./api";

/**
 * Paged, searchable list of leads. `params` accepts `search`, `projectId`,
 * `page` and `pageSize`; returns `{ data, meta }`.
 */
export async function getLeads(params = {}) {
  const { data } = await api.get("/leads", { params });
  return { data: data.data, meta: data.meta };
}

/**
 * Every lead as a flat array, for "reports to" and "assign a lead" pickers —
 * a paged list would silently truncate the choices.
 */
export async function getLeadOptions() {
  const { data } = await api.get("/leads", { params: { pageSize: "all" } });
  return data.data;
}

/** A lead with their team and projects. */
export async function getLead(leadId) {
  const { data } = await api.get(`/leads/${leadId}`);
  return data.data;
}

export async function getLeadEmployees(leadId, { projectId = null } = {}) {
  const { data } = await api.get(`/leads/${leadId}/employees`, {
    params: projectId ? { projectId } : {},
  });
  return data.data;
}

export async function getLeadProjects(leadId) {
  const { data } = await api.get(`/leads/${leadId}/projects`);
  return data.data;
}

/** Employees with no lead yet — the pool an admin assigns from. */
export async function getUnassignedEmployees() {
  const { data } = await api.get("/leads/unassigned-employees");
  return data.data;
}

export async function assignEmployeeToLead(leadId, employeeId) {
  const { data } = await api.post(`/leads/${leadId}/employees`, { employeeId });
  return data.data;
}

export async function removeEmployeeFromLead(leadId, employeeUserId) {
  const { data } = await api.delete(
    `/leads/${leadId}/employees/${employeeUserId}`,
  );
  return data.data;
}
