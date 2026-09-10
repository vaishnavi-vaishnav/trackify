import { lazy, Suspense } from "react";
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useParams,
} from "react-router-dom";
import ProtectedRoute from "./ProtectedRoute";
import AdminRoute from "./AdminRoute";
import LeadRoute from "./LeadRoute";
import { AppShell } from "../components/layout/AppShell";
import { PageLoader } from "../components/layout/PageLoader";

const LandingPage = lazy(() => import("../pages/LandingPage"));
const Login = lazy(() => import("../pages/auth/Login"));
const ActivateAccount = lazy(() => import("../pages/auth/ActivateAccount"));

// Employee
const EmployeeDashboard = lazy(() => import("../pages/employee/Dashboard"));
const AttendanceHistory = lazy(() =>
  import("../pages/employee/AttendanceHistory"),
);
const LeaveRequest = lazy(() => import("../pages/employee/LeaveRequest"));

// Lead
const LeadDashboard = lazy(() => import("../pages/lead/Dashboard"));
const LeadTeamAttendance = lazy(() => import("../pages/lead/TeamAttendance"));
const LeadReports = lazy(() => import("../pages/lead/Reports"));

// Admin
const AdminDashboard = lazy(() => import("../pages/admin/Dashboard"));
const AdminReports = lazy(() => import("../pages/admin/Reports"));
const Employees = lazy(() => import("../pages/admin/Employees"));
const Projects = lazy(() => import("../pages/admin/Projects"));
const ProjectDetail = lazy(() => import("../pages/admin/ProjectDetail"));
const Leads = lazy(() => import("../pages/admin/Leads"));
const LeadDetail = lazy(() => import("../pages/admin/LeadDetail"));

// Shared between roles — the API scopes each to what the caller may see.
const ApprovalQueue = lazy(() => import("../pages/leave/ApprovalQueue"));
const EmployeeDetail = lazy(() => import("../pages/reports/EmployeeDetail"));

const NotFound = lazy(() => import("../pages/error/NotFound"));

function EmployeeShell({ children }) {
  return (
    <ProtectedRoute>
      <AppShell>{children}</AppShell>
    </ProtectedRoute>
  );
}

function LeadShell({ children }) {
  return (
    <LeadRoute>
      <AppShell>{children}</AppShell>
    </LeadRoute>
  );
}

function AdminShell({ children }) {
  return (
    <AdminRoute>
      <AppShell>{children}</AppShell>
    </AdminRoute>
  );
}

/** Old edit-person URLs open the directory with that person's dialog. */
function EditEmployeeRedirect() {
  const { employeeId } = useParams();
  return <Navigate to={`/admin/employees?edit=${employeeId}`} replace />;
}

function AppRoutes() {
  return (
    <BrowserRouter>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Sign-in is the front door; the marketing page still has its own URL. */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/landing" element={<LandingPage />} />
          <Route path="/activate" element={<ActivateAccount />} />
          <Route path="/login" element={<Login />} />

          {/* Employee — leads use these too for their own attendance and leave */}
          <Route
            path="/dashboard"
            element={
              <EmployeeShell>
                <EmployeeDashboard />
              </EmployeeShell>
            }
          />
          <Route
            path="/attendance-history"
            element={
              <EmployeeShell>
                <AttendanceHistory />
              </EmployeeShell>
            }
          />
          <Route
            path="/leave-request"
            element={
              <EmployeeShell>
                <LeaveRequest />
              </EmployeeShell>
            }
          />

          {/* Lead */}
          <Route
            path="/lead"
            element={
              <LeadShell>
                <LeadDashboard />
              </LeadShell>
            }
          />
          <Route
            path="/lead/team-attendance"
            element={
              <LeadShell>
                <LeadTeamAttendance />
              </LeadShell>
            }
          />
          <Route
            path="/lead/leave-requests"
            element={
              <LeadShell>
                <ApprovalQueue />
              </LeadShell>
            }
          />
          <Route
            path="/lead/reports"
            element={
              <LeadShell>
                <LeadReports />
              </LeadShell>
            }
          />
          <Route
            path="/lead/reports/employee/:employeeUserId"
            element={
              <LeadShell>
                <EmployeeDetail backTo="/lead/reports" />
              </LeadShell>
            }
          />

          {/* Admin */}
          <Route
            path="/admin"
            element={
              <AdminShell>
                <AdminDashboard />
              </AdminShell>
            }
          />
          <Route
            path="/admin/reports"
            element={
              <AdminShell>
                <AdminReports />
              </AdminShell>
            }
          />
          <Route
            path="/admin/reports/employee/:employeeUserId"
            element={
              <AdminShell>
                <EmployeeDetail backTo="/admin/reports" />
              </AdminShell>
            }
          />
          <Route
            path="/admin/employees"
            element={
              <AdminShell>
                <Employees />
              </AdminShell>
            }
          />
          {/* Adding and editing a person are dialogs on the People page now.
              The old page URLs still resolve, so existing links and bookmarks
              land on the directory with the right dialog open. */}
          <Route
            path="/admin/add-employee"
            element={<Navigate to="/admin/employees?new=1" replace />}
          />
          <Route
            path="/admin/edit-employee/:employeeId"
            element={<EditEmployeeRedirect />}
          />

          <Route
            path="/admin/projects"
            element={
              <AdminShell>
                <Projects />
              </AdminShell>
            }
          />
          <Route
            path="/admin/projects/:projectId"
            element={
              <AdminShell>
                <ProjectDetail />
              </AdminShell>
            }
          />
          <Route
            path="/admin/leads"
            element={
              <AdminShell>
                <Leads />
              </AdminShell>
            }
          />
          <Route
            path="/admin/leads/:leadId"
            element={
              <AdminShell>
                <LeadDetail />
              </AdminShell>
            }
          />
          <Route
            path="/admin/leave-requests"
            element={
              <AdminShell>
                <ApprovalQueue />
              </AdminShell>
            }
          />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}

export default AppRoutes;
