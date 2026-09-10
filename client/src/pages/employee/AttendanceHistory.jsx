import { useCallback, useEffect, useState } from "react";
import { CalendarDays, CalendarRange } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Donut } from "../../components/charts/Donut";
import { getMySummary } from "../../services/attendance";
import { getProjectOptions } from "../../services/projects";
import {
  formatDateFull,
  formatRange,
  monthKey,
  monthLabel,
  recentMonths,
} from "../../lib/format";
import { breakdownSegments, dayStatus, dayStatusOrder } from "../../lib/status";

/**
 * The signed-in employee's own attendance: this month's totals, the same
 * totals week by week, and the day-by-day record behind them.
 */
function AttendanceHistory() {
  const [month, setMonth] = useState(monthKey());
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    getProjectOptions()
      .then(setProjects)
      .catch(() => {
        // Optional filter; the history below still loads without it.
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getMySummary({
        month,
        ...(projectId ? { projectId } : {}),
      });
      setData(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [month, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !data) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-8 w-52" />
          <Skeleton className="h-4 w-72 max-w-full" />
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load your attendance"
        description={
          error.response?.data?.message ||
          "Something went wrong while fetching your records."
        }
        onRetry={load}
      />
    );
  }

  const { summary, weekly, records } = data;
  const segments = breakdownSegments(summary);
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          My attendance
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {monthLabel(month)} · {records.length} recorded{" "}
          {records.length === 1 ? "day" : "days"}
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
          <Select
            label="Month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            {recentMonths(12).map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </Select>
          <Select
            label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <section
        className="grid grid-cols-2 gap-4 xl:grid-cols-5"
        aria-label={`${monthLabel(month)} totals`}
      >
        {dayStatusOrder.map((key) => (
          <StatCard
            key={key}
            label={dayStatus[key].label}
            value={summary?.[key] ?? 0}
            hint={`${monthLabel(month)}`}
            tone={
              key === "wfo"
                ? "success"
                : key === "wfh"
                  ? "info"
                  : key === "flyback"
                    ? "primary"
                    : key === "on_leave"
                      ? "warning"
                      : "danger"
            }
          />
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="flex flex-col items-center p-6">
          <div className="w-full">
            <h2 className="text-sm font-semibold text-ink">
              {monthLabel(month)}
            </h2>
            <p className="mt-0.5 text-xs text-muted">How your month was spent</p>
          </div>

          {total === 0 ? (
            <EmptyState
              icon={CalendarDays}
              title="Nothing recorded yet"
              description="Mark a day from your dashboard and it will show up here."
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
              Each week of {monthLabel(month)} that has records
            </p>
          </div>

          {weekly.length === 0 ? (
            <EmptyState
              icon={CalendarRange}
              title="No weekly data"
              description="Weeks appear here once you mark some days."
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
          <p className="text-xs text-muted">Every recorded day in {monthLabel(month)}</p>
        </div>

        {records.length === 0 ? (
          <EmptyState
            icon={CalendarDays}
            title="No records this month"
            description="Try another month, or mark today from your dashboard."
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
                <Tr key={record.id}>
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
    </div>
  );
}

export default AttendanceHistory;
