import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  CheckCircle2,
  Inbox,
  Plane,
  XCircle,
} from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { FilterChips } from "../../components/ui/FilterChips";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { PageHeader } from "../../components/layout/PageHeader";
import { LeaveRequestCard } from "../../components/leave/LeaveRequestCard";
import { LeaveRequestModal } from "../../components/leave/LeaveRequestModal";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import { cancelLeaveRequest, getMyLeaveRequests } from "../../services/leave";
import { getProjectOptions } from "../../services/projects";
import { fullName, toISODate, workingDayCount } from "../../lib/format";

/**
 * Raise and track leave.
 *
 * The list is the page — it is what people come back to check — and raising a
 * request is a dialog on top of it. Where a request goes is decided by the
 * reporting line, so the header names the actual approver rather than saying
 * "your lead" and leaving people to guess who that is.
 */
function LeaveRequest() {
  const { user, isLead, isAdmin } = useAuth();
  const { addNotification } = useNotifications();

  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);
  const [cancellingId, setCancellingId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [mine, projectList] = await Promise.all([
        getMyLeaveRequests(),
        getProjectOptions(),
      ]);
      setRequests(mine);
      setProjects(projectList);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const withdraw = async (request) => {
    setCancellingId(request.id);
    try {
      await cancelLeaveRequest(request.id);
      toast.success("Request withdrawn.");
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to withdraw it.");
    } finally {
      setCancellingId(null);
    }
  };

  const stats = useMemo(() => {
    const today = toISODate();
    const days = (r) => workingDayCount(r.start_date, r.end_date);

    return {
      pending: requests.filter((r) => r.status === "pending").length,
      approvedDays: requests
        .filter((r) => r.status === "approved" && r.leave_type !== "flyback")
        .reduce((sum, r) => sum + days(r), 0),
      flybackDays: requests
        .filter((r) => r.status === "approved" && r.leave_type === "flyback")
        .reduce((sum, r) => sum + days(r), 0),
      upcoming: requests.filter(
        (r) => r.status === "approved" && String(r.start_date) >= today,
      ).length,
      counts: {
        all: requests.length,
        pending: requests.filter((r) => r.status === "pending").length,
        approved: requests.filter((r) => r.status === "approved").length,
        rejected: requests.filter((r) => r.status === "rejected").length,
        cancelled: requests.filter((r) => r.status === "cancelled").length,
      },
    };
  }, [requests]);

  const visible =
    status === "all" ? requests : requests.filter((r) => r.status === status);

  // An employee with no lead has nowhere for a request to go; say so up front
  // rather than letting them fill in a form the server will reject.
  const unroutable = user?.role === "employee" && !user?.leadId;

  const approverLabel = isLead || isAdmin
    ? "your admin"
    : user?.approver
      ? fullName(user.approver.firstName, user.approver.lastName)
      : "your lead";

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Requests"
        description={
          unroutable
            ? "You need a lead assigned before you can raise a request"
            : `Every day is an office day unless a request changes it. Requests go to ${approverLabel}, and approved days are applied for you`
        }
        actions={
          <Button
            onClick={() => setCreating(true)}
            disabled={unroutable}
            leftIcon={CalendarPlus}
          >
            New request
          </Button>
        }
      />

      {unroutable && (
        <Card className="border-warning/30 bg-warning-soft/40 p-4">
          <p className="text-[13px] text-ink-soft">
            <span className="font-semibold">You have no lead assigned.</span>{" "}
            Requests can't be routed for approval until an admin assigns you to
            one. Please ask your administrator to set this up.
          </p>
        </Card>
      )}

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4" aria-label="Request summary">
        <StatCard
          label="Awaiting decision"
          value={stats.pending}
          icon={CalendarClock}
          tone={stats.pending ? "warning" : "neutral"}
          hint={stats.pending ? `With ${approverLabel}` : "Nothing pending"}
        />
        <StatCard
          label="Leave days"
          value={stats.approvedDays}
          icon={CheckCircle2}
          tone="success"
          hint="Approved, excluding weekends"
        />
        <StatCard
          label="Flyback days"
          value={stats.flybackDays}
          icon={Plane}
          tone="primary"
          hint="Approved flybacks"
        />
        <StatCard
          label="Upcoming"
          value={stats.upcoming}
          icon={CalendarPlus}
          tone="info"
          hint="Approved and still ahead"
        />
      </section>

      {error ? (
        <ErrorState
          title="Couldn't load your requests"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching your leave history."
          }
          onRetry={load}
        />
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={Inbox}
            title="No requests yet"
            description="When you request time off it will appear here, with its status and who decided it."
            action={
              <Button
                onClick={() => setCreating(true)}
                disabled={unroutable}
                leftIcon={CalendarPlus}
              >
                New request
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          <FilterChips
            label="Filter by status"
            value={status}
            onChange={setStatus}
            options={[
              { value: "all", label: "All", count: stats.counts.all },
              { value: "pending", label: "Pending", count: stats.counts.pending },
              { value: "approved", label: "Approved", count: stats.counts.approved },
              { value: "rejected", label: "Rejected", count: stats.counts.rejected },
              ...(stats.counts.cancelled
                ? [{ value: "cancelled", label: "Withdrawn", count: stats.counts.cancelled }]
                : []),
            ]}
          />

          {visible.length === 0 ? (
            <Card>
              <EmptyState
                icon={XCircle}
                title="Nothing with that status"
                description="Try another filter to see your other requests."
                action={
                  <Button variant="outline" size="sm" onClick={() => setStatus("all")}>
                    Show all
                  </Button>
                }
              />
            </Card>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {visible.map((request) => (
                <LeaveRequestCard
                  key={request.id}
                  request={request}
                  busy={cancellingId === request.id}
                  onCancel={withdraw}
                />
              ))}
            </div>
          )}
        </>
      )}

      <LeaveRequestModal
        open={creating}
        onClose={() => setCreating(false)}
        projects={projects}
        approverLabel={approverLabel}
        onCreated={() => {
          addNotification({
            type: "success",
            title: "Request submitted",
            body: `Your request was sent to ${approverLabel} for approval.`,
          });
          load();
        }}
      />
    </div>
  );
}

export default LeaveRequest;
