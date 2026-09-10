import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  FolderKanban,
  Home,
  Plane,
  Plus,
  Users,
  Users2,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/Table";
import { Donut } from "../../components/charts/Donut";
import {
  DailyTrend,
  DailyTrendLegend,
} from "../../components/charts/DailyTrend";
import { FilterBar } from "../../components/reports/FilterBar";
import { BreakdownTotals } from "../../components/reports/BreakdownTable";
import { useAuth } from "../../context/AuthContext";
import { getDashboardStats } from "../../services/admin";
import {
  getDailyTrend,
  getLeadBreakdown,
  getOverview,
} from "../../services/reports";
import { getProjectOptions } from "../../services/projects";
import {
  formatDateLong,
  fullName,
  greeting,
  monthKey,
  monthLabel,
} from "../../lib/format";
import { buildDailySeries } from "../../lib/series";
import { breakdownSegments, dayStatus, dayStatusOrder } from "../../lib/status";

function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [month, setMonth] = useState(monthKey());
  const [projectId, setProjectId] = useState(null);

  const [stats, setStats] = useState(null);
  const [overview, setOverview] = useState(null);
  const [leads, setLeads] = useState([]);
  const [daily, setDaily] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [s, o, l, d, p] = await Promise.all([
        getDashboardStats(),
        getOverview({ month, ...(projectId ? { projectId } : {}) }),
        getLeadBreakdown({ month, ...(projectId ? { projectId } : {}) }),
        getDailyTrend({ month, ...(projectId ? { projectId } : {}) }),
        getProjectOptions(),
      ]);
      setStats(s.data);
      setOverview(o);
      setLeads(l.leads);
      setDaily(d);
      setProjects(p);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [month, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading && !stats) {
    return (
      <div className="space-y-6" aria-busy="true" aria-label="Loading dashboard">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-80 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-24 rounded-xl" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl lg:col-span-2" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load the dashboard"
        description={
          error.response?.data?.message ||
          "Something went wrong while fetching your organisation's data."
        }
        onRetry={load}
      />
    );
  }

  const adminName = fullName(user.firstName, user.lastName, user.employeeId);
  const segments = breakdownSegments(overview?.totals);
  const monthTotal = segments.reduce((sum, s) => sum + s.value, 0);
  const officePct = monthTotal
    ? Math.round(((overview?.totals?.wfo ?? 0) / monthTotal) * 100)
    : 0;
  const dailyDays = buildDailySeries(daily?.days ?? [], daily?.range ?? {});
  const daysWithRecords = dailyDays.filter((d) => d.recorded > 0).length;

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {greeting()}, {adminName}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {formatDateLong()} · Your whole organisation at a glance
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            onClick={() => navigate("/admin/reports")}
            leftIcon={Users}
          >
            Full reports
          </Button>
          <Button onClick={() => navigate("/admin/add-employee")} leftIcon={Plus}>
            Add person
          </Button>
        </div>
      </header>

      <section
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
        aria-label="Organisation summary"
      >
        <StatCard
          label="Employees"
          value={stats.totalEmployees}
          icon={Users}
          tone="primary"
          hint={`${stats.totalLeads} lead${stats.totalLeads === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Active projects"
          value={stats.totalProjects}
          icon={FolderKanban}
          tone="info"
          hint="Currently running"
        />
        <StatCard
          label="Working today"
          value={stats.workingToday}
          icon={Building2}
          tone="success"
          hint={`${stats.wfoToday} office · ${stats.wfhToday} home`}
        />
        <StatCard
          label="Leave to approve"
          value={stats.pendingLeave}
          icon={CalendarClock}
          tone={stats.pendingLeave > 0 ? "warning" : "neutral"}
          hint={
            stats.pendingLeave > 0 ? "Waiting on a decision" : "Nothing pending"
          }
        />
      </section>

      <FilterBar
        month={month}
        onMonthChange={setMonth}
        projects={projects}
        projectId={projectId}
        onProjectChange={setProjectId}
      />

      <section className="grid gap-6 lg:grid-cols-3" aria-label="Month breakdown">
        <Card className="flex flex-col items-center p-6">
          <div className="w-full">
            <h2 className="text-sm font-semibold text-ink">
              {monthLabel(month)}
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Every recorded day across {overview?.headcount ?? 0} people
            </p>
          </div>

          {monthTotal === 0 ? (
            <EmptyState
              icon={CalendarClock}
              title="No days recorded yet"
              description="Attendance for this month will appear here as people mark their days."
            />
          ) : (
            <>
              <Donut
                segments={segments}
                size={190}
                label={`${officePct}% of recorded days were worked from the office`}
                className="mt-6"
              >
                <div className="text-center">
                  <div className="text-4xl font-bold tabular tracking-tight text-ink">
                    {monthTotal}
                  </div>
                  <div className="mt-1 text-xs font-medium text-muted">
                    days recorded
                  </div>
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
          <div className="flex flex-wrap items-center justify-between gap-4 px-5 pb-3 pt-5">
            <div>
              <h2 className="text-sm font-semibold text-ink">Lead-wise summary</h2>
              <p className="text-xs text-muted">
                {monthLabel(month)} · select a lead to see their team
              </p>
            </div>
            <Link
              to="/admin/reports"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-soft transition-colors hover:bg-slate-100 hover:text-primary"
            >
              All reports
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          {leads.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No leads yet"
              description="Create a lead, then assign employees to them to see team reporting."
              action={
                <Button
                  size="sm"
                  onClick={() => navigate("/admin/add-employee")}
                  leftIcon={Plus}
                >
                  Add a lead
                </Button>
              }
            />
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <Tr>
                  <Th>Lead</Th>
                  <Th className="text-center">Team</Th>
                  {dayStatusOrder.map((key) => (
                    <Th key={key} className="text-center">
                      {dayStatus[key].label}
                    </Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {leads.map((lead) => (
                  <Tr
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() =>
                      navigate(
                        `/admin/reports?leadId=${lead.id}&month=${month}`,
                      )
                    }
                  >
                    <Td>
                      <p className="text-sm font-medium text-ink">
                        {fullName(lead.first_name, lead.last_name)}
                      </p>
                      <p className="text-xs text-muted">{lead.employee_id}</p>
                    </Td>
                    <Td className="text-center">
                      <Badge tone={lead.team_size ? "primary" : "muted"}>
                        {lead.team_size}
                      </Badge>
                    </Td>
                    {dayStatusOrder.map((key) => (
                      <Td key={key} className="text-center">
                        {Number(lead[key]) ? (
                          <span
                            className="tabular font-semibold"
                            style={{ color: dayStatus[key].dot }}
                          >
                            {lead[key]}
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

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Day by day</h2>
            <p className="text-xs text-muted">
              How the organisation spent each day of {monthLabel(month)}
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

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Today</h2>
            <p className="text-xs text-muted">{formatDateLong()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="inline-flex items-center gap-2 text-xs">
              <Building2 className="h-4 w-4 text-success" aria-hidden="true" />
              <span className="text-muted">Office</span>
              <span className="tabular font-semibold text-ink">
                {stats.wfoToday}
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-xs">
              <Home className="h-4 w-4 text-info" aria-hidden="true" />
              <span className="text-muted">Home</span>
              <span className="tabular font-semibold text-ink">
                {stats.wfhToday}
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-xs">
              <Plane className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-muted">Flyback</span>
              <span className="tabular font-semibold text-ink">
                {stats.flybackToday}
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-xs">
              <CalendarClock className="h-4 w-4 text-warning" aria-hidden="true" />
              <span className="text-muted">On leave</span>
              <span className="tabular font-semibold text-ink">
                {stats.onLeaveToday}
              </span>
            </span>
            <span className="inline-flex items-center gap-2 text-xs">
              <span className="text-muted">Not recorded</span>
              <span className="tabular font-semibold text-ink">
                {stats.notRecordedToday}
              </span>
            </span>
          </div>
        </div>

        <div className="mt-4 border-t border-line pt-4">
          <p className="mb-2 text-xs font-medium text-muted">
            {monthLabel(month)} totals
          </p>
          <BreakdownTotals rows={overview ? [overview.totals] : []} />
        </div>
      </Card>
    </div>
  );
}

export default Dashboard;
