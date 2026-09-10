/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getCurrentUser,
  login as loginRequest,
} from "../services/auth";

const TOKEN_KEY = "token";
const USER_KEY = "user";

function readStoredUser() {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(readStoredUser);
  const [token, setToken] = useState(readStoredToken);

  const login = useCallback(async (employeeId, password) => {
    const { token: newToken, user: newUser } = await loginRequest(
      employeeId,
      password,
    );
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
    return newUser;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
  }, []);

  /**
   * Re-read the account from the server and update the cached copy.
   *
   * The user object is stored at login and then reused for every render, so
   * without this a role change or a new lead assignment would not reach the UI
   * until the person signed out and back in.
   */
  const refreshUser = useCallback(async () => {
    const fresh = await getCurrentUser();
    localStorage.setItem(USER_KEY, JSON.stringify(fresh));
    setUser(fresh);
    return fresh;
  }, []);

  // A 401 from any API call means the token expired or was revoked — the api
  // client clears storage and broadcasts this event; reset in-memory state so
  // route guards immediately send the user back to login.
  useEffect(() => {
    const onSessionExpired = () => logout();
    window.addEventListener("tw:session-expired", onSessionExpired);
    return () => window.removeEventListener("tw:session-expired", onSessionExpired);
  }, [logout]);

  // Refresh once per session start so a stale cached user (an old role, a lead
  // assigned since last login) is corrected before any page reads it. A failure
  // is not fatal: the cached user still renders, and a genuinely dead token is
  // handled by the 401 listener above.
  useEffect(() => {
    if (!token) return;
    refreshUser().catch(() => {});
  }, [token, refreshUser]);

  const value = useMemo(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(token),
      isAdmin: user?.role === "admin",
      isLead: user?.role === "lead",
      isEmployee: user?.role === "employee",
      canApproveLeave: user?.role === "admin" || user?.role === "lead",
      canViewTeamAttendance: user?.role === "admin" || user?.role === "lead",
      login,
      logout,
      setUser,
      refreshUser,
    }),
    [user, token, login, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
