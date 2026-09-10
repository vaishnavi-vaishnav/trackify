import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, CalendarRange } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Donut } from "../../components/charts/Donut";
import { LeaveRequestCard } from "../../components/leave/LeaveRequestCard";
import { getEmployeeDetail } from "../../services/reports";
import {
  formatDateFull,
  formatRange,
  fullName,
  monthKey,
  monthLabel,
  recentMonths,
} from "../../lib/format";
import {
  breakdownSegments,
  dayStatus,
  dayStatusOrder,
  roleLabels,
  roleTones,
} from "../../lib/status";

/**
 * One person's month: totals, a week-by-week breakdown, and the day-by-day
 * record behind them.
 *
 * The same page serves an admin and a lead — the API scopes the request to
 * what the caller may see, and refuses outright if they may not, so no
 * role-specific logic is needed here.
 */
function EmployeeDetail({ backTo = "/admin/reports" }) {
  const { employeeUserId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [month, setMonth] = useState(params.get("month") ?? monthKey());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getEmployeeDetail(employeeUserId, { month }));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [employeeUserId, month]);

  useEffect(() => {
    load();
  }, [load]);

  const changeMonth = (value) => {
    setMonth(value);
    setParams({ month: value }, { replace: true });
  };

  if (loading && !data) {
    return (
      <div className="space-y-6" aria-busy="true">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-28 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load this person's attendance"
        description={
          error.response?.data?.message ||
          "You may not have access to this employee, or the report failed to load."
        }
        onRetry={load}
      />
    );
  }

  const { employee, summary, weekly, records, leaveRequests } = data;
  const name = fullName(employee.firstName, employee.lastName);
  const segments = breakdownSegments(summary);
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const months = recentMonths(12);

  return (
    <div className="animate-fade-up space-y-6">
      <Button
        variant="ghost"
        size="sm"
        leftIcon={ArrowLeft}
        onClick={() => navigate(backTo)}
        className="-ml-2"
      >
        Back to reports
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={name} size="lg" />
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-ink">{name}</h1>
            <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted">
              <span className="tabular">{employee.employeeId}</span>
              <Badge tone={roleTones[employee.role] ?? "neutral"}>
                {roleLabels[employee.role] ?? employee.role}
              </Badge>
              {employee.department && <span>· {employee.department}</span>}
              {employee.designation && <span>· {employee.designation}</span>}
            </p>
          </div>
        </div>

        <Select
          label="Month"
          value={month}
          onChange={(e) => changeMonth(e.target.value)}
          className="min-w-[12rem]"
        >
          {months.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
      </header>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center p-6">
          <div className="w-full">
            <h2 className="text-sm font-semibold text-ink">
              {monthLabel(month)}
            </h2>
            <p className="mt-0.5 text-xs text-muted">How the month was spent</p>
          </div>

          {total === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="No working days yet"
              description="Days appear here as the month progresses."
            />
          ) : (
            <>
              <Donut
                segments={segments}
                size={180}
                label={`${total} days recorded in ${monthLabel(month)}`}
                className="mt-6"
              >
                <div className="text-center">
                  <div className="text-4xl font-bold tabular tracking-tight text-ink">
                    {total}
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted">days</div>
                </div>
              </Donut>

              <ul className="mt-6 w-full space-y-3">
                {segments.map((seg) => (
                  <li key={seg.key} className="flex items-center gap-3">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: seg.dot }}
                      aria-hidden="true"
                    />
                    <span className="flex-1 text-sm text-muted">{seg.label}</span>
                    <span className="text-sm font-semibold tabular text-ink">
                      {seg.value}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </Card>

        <Card className="overflow-hidden lg:col-span-2">
          <div className="border-b border-line px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink">
              <CalendarRange className="h-4 w-4 text-muted" aria-hidden="true" />
              Week by week
            </h2>
            <p className="text-xs text-muted">
              Each week of {monthLabel(month)} so far
            </p>
          </div>

          {weekly.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="No weekly data"
              description="Weeks appear here as the month progresses."
            />
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <Tr>
                  <Th>Week</Th>
                  {dayStatusOrder.map((key) => (
                    <Th key={key} className="text-center">
                      {dayStatus[key].label}
                    </Th>
                  ))}
                  <Th className="text-center">Days</Th>
                </Tr>
              </THead>
              <TBody>
                {weekly.map((week) => (
                  <Tr key={week.week_start}>
                    <Td className="whitespace-nowrap text-sm font-medium text-ink">
                      {formatRange(week.week_start, week.week_end)}
                    </Td>
                    {dayStatusOrder.map((key) => (
                      <Td key={key} className="text-center">
                        {Number(week[key]) ? (
                          <span
                            className="tabular font-semibold"
                            style={{ color: dayStatus[key].dot }}
                          >
                            {week[key]}
                          </span>
                        ) : (
                          <span className="tabular text-faint">0</span>
                        )}
                      </Td>
                    ))}
                    <Td className="text-center tabular font-medium text-ink">
                      {week.days_recorded}
                    </Td>
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      </section>

      <Card className="overflow-hidden">
        <div className="border-b border-line px-5 py-4">
          <h2 className="text-sm font-semibold text-ink">Day by day</h2>
          <p className="text-xs text-muted">
            {records.length} working {records.length === 1 ? "day" : "days"} in{" "}
            {monthLabel(month)} · office unless a request changed it
          </p>
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No working days yet"
            description="Days appear here as the month progresses."
          />
        ) : (
          <Table className="rounded-none border-0">
            <THead>
              <Tr>
                <Th>Date</Th>
                <Th>Status</Th>
                <Th>Project</Th>
                <Th>Notes</Th>
              </Tr>
            </THead>
            <TBody>
              {records.map((record) => (
                <Tr key={record.work_date}>
                  <Td className="whitespace-nowrap font-medium text-ink">
                    {formatDateFull(record.work_date)}
                  </Td>
                  <Td>
                    <StatusBadge status={record.status} />
                  </Td>
                  <Td className="text-muted">
                    {record.project_name || <span className="text-faint">—</span>}
                  </Td>
                  <Td className="max-w-[16rem] truncate text-muted">
                    {record.notes || <span className="text-faint">—</span>}
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
        )}
      </Card>

      {leaveRequests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-ink">Leave history</h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {leaveRequests.slice(0, 6).map((request) => (
              <LeaveRequestCard key={request.id} request={request} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export default EmployeeDetail;
