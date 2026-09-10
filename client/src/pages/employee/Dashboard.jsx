import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  CalendarPlus,
  Home,
  Plane,
} from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { DailyTrend } from "../../components/charts/DailyTrend";
import { LeaveRequestCard } from "../../components/leave/LeaveRequestCard";
import { useAuth } from "../../context/AuthContext";
import { getMySummary, getTodayAttendance } from "../../services/attendance";
import { getDailyTrend } from "../../services/reports";
import { getMyLeaveRequests } from "../../services/leave";
import {
  formatDateLong,
  fullName,
  greeting,
  monthKey,
  monthLabel,
} from "../../lib/format";
import { buildDailySeries } from "../../lib/series";
import { dayStatus } from "../../lib/status";

/**
 * The employee's day needs nothing from them.
 *
 * Every working day is an office day unless an approved request says
 * otherwise, so there is no clock to start and no status to set here — this
 * page reports what today already is and points at the one action that can
 * change it.
 */
function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [today, setToday] = useState(null);
  const [daily, setDaily] = useState(null);
  const [summary, setSummary] = useState(null);
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const month = monthKey();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [t, d, s, requests] = await Promise.all([
        getTodayAttendance(),
        getDailyTrend({ month, employeeId: user.id }),
        getMySummary({ month }),
        getMyLeaveRequests({ status: "pending" }),
      ]);
      setToday(t.data);
      setDaily(d);
      setSummary(s.data.summary);
      setPending(requests);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [month, user.id]);

  useEffect(() => {
    load();
  }, [load]);

  const monthDays = useMemo(
    () => buildDailySeries(daily?.days ?? [], daily?.range ?? {}),
    [daily],
  );

  if (loading && !today) {
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
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error) {
    return (
      <ErrorState
        title="Couldn't load your dashboard"
        description={
          error.response?.data?.message ||
          "Something went wrong while fetching your days."
        }
        onRetry={load}
      />
    );
  }

  const name = fullName(user.firstName, user.lastName, user.employeeId);
  const status = today.status;

  return (
    <div className="animate-fade-up space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-[28px]">
            {greeting()}, {name}
          </h1>
          <p className="mt-1.5 text-sm text-muted">
            {formatDateLong()} ·{" "}
            {today.workingDay ? (
              <>
                you're{" "}
                <span className="font-medium text-ink-soft">
                  {(dayStatus[status]?.label ?? status).toLowerCase() ===
                  "office"
                    ? "in the office"
                    : dayStatus[status]?.label.toLowerCase()}
                </span>
                {today.isDefault && " by default"}
              </>
            ) : (
              "not a working day"
            )}
          </p>
        </div>
        <Button
          onClick={() => navigate("/leave-request")}
          leftIcon={CalendarPlus}
        >
          Raise a request
        </Button>
      </header>

      <section
        className="grid grid-cols-2 gap-4 xl:grid-cols-4"
        aria-label={`${monthLabel(month)} so far`}
      >
        <StatCard
          label="Office days"
          value={summary?.wfo ?? 0}
          icon={Building2}
          tone="success"
          hint={monthLabel(month)}
        />
        <StatCard
          label="Home days"
          value={summary?.wfh ?? 0}
          icon={Home}
          tone="info"
          hint="Approved"
        />
        <StatCard
          label="Flyback"
          value={summary?.flyback ?? 0}
          icon={Plane}
          tone="primary"
          hint="Approved"
        />
        <StatCard
          label="Leave taken"
          value={summary?.on_leave ?? 0}
          icon={CalendarDays}
          tone="warning"
          hint={monthLabel(month)}
        />
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Card className="p-5">
          <h2 className="text-sm font-semibold text-ink">Today</h2>
          <p className="mt-0.5 text-xs text-muted">{formatDateLong()}</p>

          {today.workingDay ? (
            <>
              <div className="mt-6 flex flex-col items-center gap-3 py-4">
                <StatusBadge status={status} />
                <p className="text-center text-sm text-muted">
                  {today.isDefault
                    ? "Nothing to do — you're counted as working from the office."
                    : today.projectName
                      ? `Approved · booked against ${today.projectName}`
                      : "Approved request"}
                </p>
              </div>
              <div className="border-t border-line pt-4">
                <p className="text-xs text-muted">
                  Working from home, a flyback or leave all need your lead's
                  approval before the day changes.
                </p>
              </div>
            </>
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="Not a working day"
              description="Weekends carry no status."
            />
          )}
        </Card>

        <Card className="p-5 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">Day by day</h2>
              <p className="text-xs text-muted">
                Every working day of {monthLabel(month)} so far
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/attendance-history")}
              leftIcon={ArrowRight}
            >
              Full history
            </Button>
          </div>
          <DailyTrend
            days={monthDays}
            summary={`${summary?.days_recorded ?? 0} working days so far`}
            className="mt-4"
          />
        </Card>
      </section>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              Waiting on approval
            </h2>
            <p className="text-xs text-muted">
              {pending.length
                ? `${pending.length} request${pending.length === 1 ? "" : "s"} with your lead`
                : "Nothing pending"}
            </p>
          </div>
          <Badge tone={pending.length ? "warning" : "neutral"}>
            {pending.length}
          </Badge>
        </div>

        {pending.length === 0 ? (
          <EmptyState
            icon={CalendarPlus}
            title="No open requests"
            description="Raise one for a day at home, a flyback or leave."
            action={
              <Button size="sm" onClick={() => navigate("/leave-request")}>
                Raise a request
              </Button>
            }
          />
        ) : (
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {pending.slice(0, 4).map((request) => (
              <LeaveRequestCard key={request.id} request={request} />
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

export default Dashboard;
