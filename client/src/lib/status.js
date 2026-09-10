/**
 * Status → label / tone / dot color mapping.
 * The dot hex is the single source of truth for both badge dots and SVG
 * charts (donut slices, gauges), so colors never drift between UI and charts.
 */
export const accountStatus = {
  active: { label: "Active", tone: "success", dot: "#059669" },
  inactive: { label: "Inactive", tone: "danger", dot: "#e11d48" },
  pending: { label: "Pending", tone: "warning", dot: "#d97706" },
};

/**
 * How a working day was spent — the vocabulary the whole app reports on.
 *
 * `wfo` is the default every working day carries unless an approved request
 * moved it; the other three only ever arrive that way.
 */
export const dayStatus = {
  wfo: { label: "Office", tone: "success", dot: "#059669" },
  wfh: { label: "Home", tone: "info", dot: "#0284c7" },
  flyback: { label: "Flyback", tone: "primary", dot: "#6366f1" },
  on_leave: { label: "On leave", tone: "warning", dot: "#d97706" },
};

/** Order used for every breakdown table, legend and chart. */
export const dayStatusOrder = ["wfo", "wfh", "flyback", "on_leave"];

export const leaveStatus = {
  pending: { label: "Pending", tone: "warning", dot: "#d97706" },
  approved: { label: "Approved", tone: "success", dot: "#059669" },
  rejected: { label: "Rejected", tone: "danger", dot: "#e11d48" },
  cancelled: { label: "Cancelled", tone: "muted", dot: "#94a3b8" },
};

/**
 * What an employee can ask for. Every exception to the default office day is
 * raised here — working from home included — and takes an approval.
 */
export const leaveTypes = [
  { value: "wfh", label: "Work from home" },
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick leave" },
  { value: "flyback", label: "Flyback" },
  { value: "other", label: "Other" },
];

/** The day a request produces once approved, for previewing before it is sent. */
export const dayStatusForLeaveType = (type) =>
  type === "wfh" ? "wfh" : type === "flyback" ? "flyback" : "on_leave";

/** Resolve an arbitrary status string to display config. */
export function resolveStatus(status) {
  if (!status) return { label: "—", tone: "neutral" };
  return (
    dayStatus[status] ??
    leaveStatus[status] ??
    accountStatus[status] ?? {
      label: String(status).replace(/_/g, " "),
      tone: "neutral",
    }
  );
}

/** Turn a breakdown row into ordered chart/legend segments. */
export function breakdownSegments(row) {
  if (!row) return [];
  return dayStatusOrder.map((key) => ({
    key,
    label: dayStatus[key].label,
    dot: dayStatus[key].dot,
    value: Number(row[key] ?? 0),
  }));
}

export const roleLabels = {
  admin: "Admin",
  lead: "Lead",
  employee: "Employee",
};

export const roleTones = {
  admin: "primary",
  lead: "info",
  employee: "neutral",
};
