import api from "./api";

/**
 * A project has many leads; each lead has many employees. A project's people
 * are reached through its leads rather than assigned to it directly.
 *
 * Two read shapes, deliberately separate: `getProjects` is the browsable list
 * (paged, filtered, returns `meta`), while `getProjectOptions` is the flat
 * array a `<select>` needs. Mixing them is what makes a picker silently show
 * only the first page once a customer has more projects than fit on one.
 */

/** Paged list. `params` accepts `search`, `status`, `page`, `pageSize`. */
export async function getProjects(params = {}) {
  const { data } = await api.get("/projects", { params });
  return { data: data.data, meta: data.meta };
}

/** Every active project, for dropdowns. */
export async function getProjectOptions() {
  const { data } = await api.get("/projects", {
    params: { activeOnly: true, pageSize: "all" },
  });
  return data.data;
}

/** A project plus its leads, employees and departments. */
export async function getProject(projectId) {
  const { data } = await api.get(`/projects/${projectId}`);
  return data.data;
}

export async function createProject(payload) {
  const { data } = await api.post("/projects", payload);
  return data.data;
}

export async function updateProject(projectId, payload) {
  const { data } = await api.put(`/projects/${projectId}`, payload);
  return data.data;
}

export async function deleteProject(projectId, { force = false } = {}) {
  const { data } = await api.delete(`/projects/${projectId}`, {
    params: force ? { force: true } : {},
  });
  return data;
}

export async function getProjectLeads(projectId) {
  const { data } = await api.get(`/projects/${projectId}/leads`);
  return data.data;
}

export async function assignLeadToProject(projectId, leadId, departmentId = null) {
  const { data } = await api.post(`/projects/${projectId}/leads`, {
    leadId,
    departmentId,
  });
  return data.data;
}

export async function removeLeadFromProject(projectId, leadId) {
  const { data } = await api.delete(`/projects/${projectId}/leads/${leadId}`);
  return data;
}

export async function getDepartments(projectId) {
  const { data } = await api.get(`/projects/${projectId}/departments`);
  return data.data;
}

export async function createDepartment(projectId, name) {
  const { data } = await api.post(`/projects/${projectId}/departments`, { name });
  return data.data;
}

export async function updateDepartment(projectId, departmentId, name) {
  const { data } = await api.put(
    `/projects/${projectId}/departments/${departmentId}`,
    { name },
  );
  return data.data;
}

export async function deleteDepartment(projectId, departmentId) {
  const { data } = await api.delete(
    `/projects/${projectId}/departments/${departmentId}`,
  );
  return data;
}
