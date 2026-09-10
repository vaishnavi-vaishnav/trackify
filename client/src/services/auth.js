import api from "./api";

/** POST /auth/login → { token, user }. */
export async function login(employeeId, password) {
  const { data } = await api.post("/auth/login", { employeeId, password });
  return data;
}

/**
 * GET /auth/me → the signed-in account as the server currently sees it.
 * Used to refresh a cached user whose role or lead assignment has changed.
 */
export async function getCurrentUser() {
  const { data } = await api.get("/auth/me");
  return data.user;
}

/** POST /auth/send-activation-link → { success, message }. */
export async function sendActivationLink(employeeId) {
  const { data } = await api.post("/auth/send-activation-link", { employeeId });
  return data;
}

/** POST /auth/activate → { success, message }. */
export async function activateAccount({ employeeId, password, confirmPassword }) {
  const { data } = await api.post("/auth/activate", {
    employeeId,
    password,
    confirmPassword,
  });
  return data;
}
