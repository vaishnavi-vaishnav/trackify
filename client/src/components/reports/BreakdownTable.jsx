import { ArrowRight } from "lucide-react";
import { Avatar } from "../ui/Avatar";
import { Badge } from "../ui/Badge";
import { EmptyState } from "../ui/EmptyState";
import { Table, TBody, Td, Th, THead, Tr } from "../ui/Table";
import { dayStatus, dayStatusOrder, roleLabels, roleTones } from "../../lib/status";
import { fullName } from "../../lib/format";
import { cn } from "../../lib/utils";

/**
 * A zero reads as noise in a dense grid of counts, so it is dimmed and the
 * real numbers carry their status colour — the eye lands on what happened.
 */
function Count({ value, tone }) {
  const n = Number(value ?? 0);
  if (!n) return <span className="tabular text-faint">0</span>;
  return (
    <span className="tabular font-semibold" style={{ color: tone }}>
      {n}
    </span>
  );
}

/**
 * Per-person status breakdown for a period — the table shared by the admin
 * dashboard, the lead's team view and the reports page.
 *
 * `onSelect` makes rows clickable (drilling into one person's month).
 */
export function BreakdownTable({
  rows,
  onSelect,
  showLead = true,
  showRole = false,
  emptyTitle = "Nothing to show",
  emptyDescription = "No people match these filters yet.",
  emptyIcon,
  emptyAction,
}) {
  if (!rows?.length) {
    return (
      <EmptyState
        icon={emptyIcon}
        title={emptyTitle}
        description={emptyDescription}
        action={emptyAction}
      />
    );
  }

  return (
    <Table>
      <THead>
        <Tr>
          <Th>Person</Th>
          {showRole && <Th>Role</Th>}
          {showLead && <Th>Reports to</Th>}
          {dayStatusOrder.map((key) => (
            <Th key={key} className="text-center">
              {dayStatus[key].label}
            </Th>
          ))}
          <Th className="text-center">Days</Th>
          {onSelect && <Th aria-label="View details" />}
        </Tr>
      </THead>
      <TBody>
        {rows.map((row) => {
          const name = fullName(row.first_name, row.last_name);
          return (
            <Tr
              key={row.id}
              onClick={onSelect ? () => onSelect(row) : undefined}
              className={cn(onSelect && "cursor-pointer")}
            >
              <Td>
                <div className="flex items-center gap-3">
                  <Avatar name={name} size="md" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{name}</p>
                    <p className="text-xs tabular text-muted">
                      {row.employee_id}
                      {row.department ? ` · ${row.department}` : ""}
                    </p>
                  </div>
                </div>
              </Td>

              {showRole && (
                <Td>
                  <Badge tone={roleTones[row.role] ?? "neutral"}>
                    {roleLabels[row.role] ?? row.role}
                  </Badge>
                </Td>
              )}

              {showLead && (
                <Td className="text-muted">
                  {row.lead_first_name ? (
                    fullName(row.lead_first_name, row.lead_last_name)
                  ) : (
                    <span className="text-faint">—</span>
                  )}
                </Td>
              )}

              {dayStatusOrder.map((key) => (
                <Td key={key} className="text-center">
                  <Count value={row[key]} tone={dayStatus[key].dot} />
                </Td>
              ))}

              <Td className="text-center tabular font-medium text-ink">
                {Number(row.days_recorded ?? 0)}
              </Td>

              {onSelect && (
                <Td className="text-right">
                  <ArrowRight
                    className="ml-auto h-4 w-4 text-faint"
                    aria-hidden="true"
                  />
                </Td>
              )}
            </Tr>
          );
        })}
      </TBody>
    </Table>
  );
}

/** The same row shape, summed — rendered as a legend strip of totals. */
export function BreakdownTotals({ rows, className }) {
  const totals = dayStatusOrder.reduce((acc, key) => {
    acc[key] = (rows ?? []).reduce((sum, row) => sum + Number(row[key] ?? 0), 0);
    return acc;
  }, {});

  return (
    <div className={cn("flex flex-wrap items-center gap-x-5 gap-y-2", className)}>
      {dayStatusOrder.map((key) => (
        <span key={key} className="inline-flex items-center gap-2 text-xs">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: dayStatus[key].dot }}
            aria-hidden="true"
          />
          <span className="text-muted">{dayStatus[key].label}</span>
          <span className="tabular font-semibold text-ink">{totals[key]}</span>
        </span>
      ))}
    </div>
  );
}
