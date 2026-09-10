import api from "./api";

/**
 * Leave routes one step up the reporting line: an employee's request goes to
 * their lead, a lead's to the admin. `/leave/queue` returns whichever of those
 * queues belongs to the caller.
 */

export async function createLeaveRequest(payload) {
  const { data } = await api.post("/leave/request", payload);
  return data.data;
}

export async function getMyLeaveRequests({ status = null } = {}) {
  const { data } = await api.get("/leave/my-requests", {
    params: status ? { status } : {},
  });
  return data.data;
}

/**
 * The caller's approval queue. An admin gets the requests routed to them
 * (leads' own leave); pass `scope: "all"` for every request in the system.
 */
export async function getApprovalQueue({
  status = null,
  projectId = null,
  leadId = null,
  scope = null,
} = {}) {
  const { data } = await api.get("/leave/queue", {
    params: {
      ...(status ? { status } : {}),
      ...(projectId ? { projectId } : {}),
      ...(leadId ? { leadId } : {}),
      ...(scope ? { scope } : {}),
    },
  });
  return data.data;
}

export async function getLeaveRequest(leaveRequestId) {
  const { data } = await api.get(`/leave/${leaveRequestId}`);
  return data.data;
}

export async function approveLeaveRequest(leaveRequestId, approvalNotes = null) {
  const { data } = await api.post(`/leave/${leaveRequestId}/approve`, {
    approvalNotes,
  });
  return data.data;
}

export async function rejectLeaveRequest(leaveRequestId, rejectionReason) {
  const { data } = await api.post(`/leave/${leaveRequestId}/reject`, {
    rejectionReason,
  });
  return data.data;
}

export async function cancelLeaveRequest(leaveRequestId) {
  const { data } = await api.post(`/leave/${leaveRequestId}/cancel`);
  return data.data;
}

export async function updateLeaveRequest(leaveRequestId, payload) {
  const { data } = await api.put(`/leave/${leaveRequestId}`, payload);
  return data.data;
}

export async function deleteLeaveRequest(leaveRequestId) {
  const { data } = await api.delete(`/leave/${leaveRequestId}`);
  return data;
}
