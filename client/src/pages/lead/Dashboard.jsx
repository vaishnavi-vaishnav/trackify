import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarCheck,
  CalendarClock,
  Home,
  Users2,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Avatar } from "../../components/ui/Avatar";
import { LeaveRequestCard } from "../../components/leave/LeaveRequestCard";
import { BreakdownTotals } from "../../components/reports/BreakdownTable";
import {
  DailyTrend,
  DailyTrendLegend,
} from "../../components/charts/DailyTrend";
import { useAuth } from "../../context/AuthContext";
import { getDailyTrend, getEmployeeBreakdown } from "../../services/reports";
import { getTeamAttendance } from "../../services/attendance";
import { getApprovalQueue } from "../../services/leave";
import { getLeadProjects } from "../../services/leads";
import {
  formatDateLong,
  fullName,
  greeting,
  monthKey,
  monthLabel,
  recentMonths,
  toISODate,
} from "../../lib/format";
import { buildDailySeries } from "../../lib/series";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [month, setMonth] = useState(monthKey());
  const [projectId, setProjectId] = useState("");

  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [breakdown, setBreakdown] = useState([]);
  const [daily, setDaily] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const today = toISODate();

  useEffect(() => {
    if (!user?.id) return;
    getLeadProjects(user.id)
      .then(setProjects)
      .catch(() => {
        // The project filter is a convenience; the dashboard works without it.
      });
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [todayTeam, report, trend, queue] = await Promise.all([
        getTeamAttendance({
          workDate: today,
          ...(projectId ? { projectId } : {}),
        }),
        getEmployeeBreakdown({
          month,
          ...(projectId ? { projectId } : {}),
        }),
        getDailyTrend({ month, ...(projectId ? { projectId } : {}) }),
        getApprovalQueue({ status: "pending" }),
      ]);
      setTeam(todayTeam.data);
      setBreakdown(report.employees);
      setDaily(trend);
      setPending(queue);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [month, projectId, today]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !team.length && !breakdown.length) {
    return (
      <div className="space-y-6" aria-busy="true">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
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
        title="Couldn't load your team"
        description={
          error.response?.data?.message ||
          "Something went wrong while fetching your team's data."
        }
        onRetry={load}
      />
    );
  }

  const leadName = fullName(user.firstName, user.lastName, user.employeeId);
  const working = team.filter((m) => m.status);
  const counts = {
    office: working.filter((m) => m.status === "wfo").length,
    home: working.filter((m) => m.status === "wfh").length,
    leave: working.filter((m) => m.status === "on_leave").length,
    flyback: working.filter((m) => m.status === "flyback").length,
  };
  const dailyDays = buildDailySeries(daily?.days ?? [], daily?.range ?? {});
  const daysWithRecords = dailyDays.filter((d) => d.recorded > 0).length;

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {greeting()}, {leadName}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {formatDateLong()} · Your team at a glance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/lead/team-attendance")}
            leftIcon={Users2}
          >
            Team attendance
          </Button>
          {pending.length > 0 && (
            <Button
              onClick={() => navigate("/lead/leave-requests")}
              leftIcon={CalendarCheck}
            >
              {pending.length} to approve
            </Button>
          )}
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Today">
        <StatCard
          label="Team size"
          value={team.length}
          icon={Users2}
          tone="primary"
          hint={`${counts.leave} away today`}
        />
        <StatCard
          label="In the office"
          value={counts.office}
          icon={Building2}
          tone="success"
          hint="Today"
        />
        <StatCard
          label="Working from home"
          value={counts.home}
          icon={Home}
          tone="info"
          hint="Today"
        />
        <StatCard
          label="Leave to approve"
          value={pending.length}
          icon={CalendarClock}
          tone={pending.length > 0 ? "warning" : "neutral"}
          hint={pending.length > 0 ? "Waiting on you" : "Nothing pending"}
        />
      </section>

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
            hint={
              projects.length === 0
                ? "You're not assigned to a project yet"
                : undefined
            }
          >
            <option value="">All my projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Day by day</h2>
            <p className="text-xs text-muted">
              How your team spent each day of {monthLabel(month)}
            </p>
          </div>
          <DailyTrendLegend />
        </div>
        <DailyTrend
          days={dailyDays}
          summary={
            daysWithRecords > 0
              ? `${daysWithRecords} of ${dailyDays.length} days have records`
              : `Nothing recorded yet in ${monthLabel(month)}`
          }
          className="mt-4"
        />
      </Card>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              {monthLabel(month)} breakdown
            </h2>
            <p className="text-xs text-muted">
              Select anyone to see their day-by-day and weekly detail
            </p>
          </div>
          <BreakdownTotals rows={breakdown} />
        </div>

        {breakdown.length === 0 ? (
          <EmptyState
            icon={Users2}
            title="Nobody reports to you yet"
            description="Once an admin assigns employees to you, their attendance appears here."
          />
        ) : (
          <Table className="rounded-none border-0">
            <THead>
              <Tr>
                <Th>Person</Th>
                <Th className="text-center">Office</Th>
                <Th className="text-center">Home</Th>
                <Th className="text-center">Flyback</Th>
                <Th className="text-center">On leave</Th>
                <Th className="text-center">Days</Th>
              </Tr>
            </THead>
            <TBody>
              {breakdown.map((row) => {
                const name = fullName(row.first_name, row.last_name);
                return (
                  <Tr
                    key={row.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(`/lead/reports/employee/${row.id}?month=${month}`)
                    }
                  >
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {name}
                          </p>
                          <p className="text-xs tabular text-muted">
                            {row.employee_id}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-center tabular font-medium text-success">
                      {row.wfo || <span className="text-faint">0</span>}
                    </Td>
                    <Td className="text-center tabular font-medium text-info">
                      {row.wfh || <span className="text-faint">0</span>}
                    </Td>
                    <Td className="text-center tabular font-medium text-primary">
                      {row.flyback || <span className="text-faint">0</span>}
                    </Td>
                    <Td className="text-center tabular font-medium text-warning">
                      {row.on_leave || <span className="text-faint">0</span>}
                    </Td>
                    <Td className="text-center tabular text-ink">
                      {row.days_recorded}
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>
        )}
      </Card>

      <section className="grid gap-6 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Today</h2>
              <p className="text-xs text-muted">
                {counts.leave} on leave · {counts.flyback} flyback
              </p>
            </div>
            <Link
              to="/lead/team-attendance"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-slate-100 hover:text-primary"
            >
              Details
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {team.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No team yet"
              description="Employees assigned to you will show up here."
            />
          ) : (
            <ul className="divide-y divide-line">
              {team.map((member) => {
                const name = fullName(member.first_name, member.last_name);
                return (
                  <li
                    key={member.id}
                    className="flex items-center gap-3 px-5 py-3"
                  >
                    <Avatar name={name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-ink">
                        {name}
                      </p>
                      <p className="text-xs text-muted">
                        {member.leave_request_id
                          ? "approved request"
                          : member.status === "wfo"
                            ? "default"
                            : "—"}
                      </p>
                    </div>
                    {member.status ? (
                      <StatusBadge status={member.status} />
                    ) : (
                      <Badge tone="muted">Non-working day</Badge>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="overflow-hidden">
          <div className="flex items-center justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                Waiting on your approval
              </h2>
              <p className="text-xs text-muted">
                {pending.length} pending request
                {pending.length === 1 ? "" : "s"}
              </p>
            </div>
            <Link
              to="/lead/leave-requests"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-slate-100 hover:text-primary"
            >
              All requests
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {pending.length === 0 ? (
            <EmptyState
              icon={CalendarCheck}
              title="Nothing waiting on you"
              description="Every request from your team has been decided."
            />
          ) : (
            <div className="space-y-3 p-4">
              {pending.slice(0, 2).map((request) => (
                <LeaveRequestCard key={request.id} request={request} />
              ))}
              {pending.length > 2 && (
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => navigate("/lead/leave-requests")}
                >
                  Review all {pending.length}
                </Button>
              )}
            </div>
          )}
        </Card>
      </section>
    </div>
  );
}

export default Dashboard;
