import { Card } from "../ui/Card";
import { Select } from "../ui/Select";
import { fullName, recentMonths } from "../../lib/format";

/**
 * The month / project / lead selectors shared by every reporting view.
 *
 * Each control renders only when the caller passes a handler for it, so the
 * same bar serves the admin (all three) and a lead (month and project only,
 * since their own team is the whole scope).
 */
export function FilterBar({
  month,
  onMonthChange,
  projects,
  projectId,
  onProjectChange,
  leads,
  leadId,
  onLeadChange,
  children,
}) {
  const months = recentMonths(12);

  return (
    <Card className="p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {onMonthChange && (
          <Select
            label="Month"
            value={month}
            onChange={(e) => onMonthChange(e.target.value)}
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
        )}

        {onProjectChange && (
          <Select
            label="Project"
            value={projectId ?? ""}
            onChange={(e) => onProjectChange(e.target.value || null)}
          >
            <option value="">All projects</option>
            {(projects ?? []).map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        )}

        {onLeadChange && (
          <Select
            label="Lead"
            value={leadId ?? ""}
            onChange={(e) => onLeadChange(e.target.value || null)}
          >
            <option value="">All leads</option>
            {(leads ?? []).map((lead) => (
              <option key={lead.id} value={lead.id}>
                {fullName(lead.first_name, lead.last_name)}
              </option>
            ))}
          </Select>
        )}

        {children}
      </div>
    </Card>
  );
}
