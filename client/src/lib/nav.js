import {
  BarChart3,
  CalendarCheck,
  CalendarDays,
  FolderKanban,
  History,
  LayoutDashboard,
  Users,
  Users2,
} from "lucide-react";

export const employeeNav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/attendance-history", label: "My Attendance", icon: History },
  { to: "/leave-request", label: "Requests", icon: CalendarDays },
];

// A lead has both jobs: running their team, and recording their own day. The
// last two items are the personal pages every employee gets.
export const leadNav = [
  { to: "/lead", label: "Dashboard", icon: LayoutDashboard },
  { to: "/lead/team-attendance", label: "Team Attendance", icon: Users2 },
  { to: "/lead/leave-requests", label: "Approvals", icon: CalendarCheck },
  { to: "/lead/reports", label: "Team Reports", icon: BarChart3 },
  { to: "/dashboard", label: "My Day", icon: History },
  { to: "/leave-request", label: "My Requests", icon: CalendarDays },
];

// Adding a person is an action on the People page (a dialog), not a
// destination of its own — a menu entry for it would be a second way to reach
// the same form and would keep the sidebar growing with every new action.
export const adminNav = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/reports", label: "Reports", icon: BarChart3 },
  { to: "/admin/employees", label: "People", icon: Users },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/leads", label: "Leads & Teams", icon: Users2 },
  { to: "/admin/leave-requests", label: "Approvals", icon: CalendarCheck },
];

export function navForRole(role) {
  if (role === "admin") return adminNav;
  if (role === "lead") return leadNav;
  return employeeNav;
}

/** Where a role lands after signing in — the first item of their menu. */
export function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "lead") return "/lead";
  return "/dashboard";
}

/**
 * Titles for pages that are reachable but not in any menu (detail and
 * drill-down routes), so the topbar never falls back to the bare product name.
 */
const extraTitles = [
  { to: "/admin/reports/employee", label: "Employee Report" },
  { to: "/lead/reports/employee", label: "Employee Report" },
  { to: "/admin/projects/", label: "Project" },
  { to: "/admin/leads/", label: "Team" },
  { to: "/attendance-history", label: "My Attendance" },
];

/**
 * True when a nav item should render as active for the current path.
 *
 * A section root ("/admin", "/lead") matches only itself — prefix-matching it
 * would light up the parent for every child page and make two items look
 * active at once. Deeper items still match their own sub-paths.
 */
export function isNavActive(pathname, to) {
  if (to === "/admin" || to === "/lead") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

/** Page title used by the topbar, derived from the current route. */
export function titleForPath(pathname, role) {
  const candidates = [...navForRole(role), ...extraTitles]
    // Longest match first, so "/admin/reports/employee" beats "/admin/reports",
    // which in turn beats "/admin".
    .sort((a, b) => b.to.length - a.to.length);

  const match = candidates.find((item) => isNavActive(pathname, item.to));
  return match?.label ?? "Trackify";
}
