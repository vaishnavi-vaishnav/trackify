import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeForRole } from "../lib/nav";

export default function AdminRoute({ children }) {
  const { isAuthenticated, isAdmin, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  // Send a non-admin to their own home rather than a page they cannot use.
  if (!isAdmin) return <Navigate to={homeForRole(user?.role)} replace />;
  return children;
}
