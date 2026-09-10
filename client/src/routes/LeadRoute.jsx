import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { homeForRole } from "../lib/nav";

/** Lead-only pages. Admins are let through so they can oversee any team. */
function LeadRoute({ children }) {
  const { isAuthenticated, isLead, isAdmin, user } = useAuth();

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!isLead && !isAdmin) return <Navigate to={homeForRole(user?.role)} replace />;
  return children;
}

export default LeadRoute;
