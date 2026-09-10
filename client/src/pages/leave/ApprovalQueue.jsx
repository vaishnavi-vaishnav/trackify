import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, Inbox } from "lucide-react";
import { toast } from "react-toastify";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { LeaveRequestCard } from "../../components/leave/LeaveRequestCard";
import { useAuth } from "../../context/AuthContext";
import { useNotifications } from "../../context/NotificationContext";
import {
  approveLeaveRequest,
  getApprovalQueue,
  rejectLeaveRequest,
} from "../../services/leave";
import { getProjectOptions } from "../../services/projects";
import { fullName } from "../../lib/format";
import { cn } from "../../lib/utils";

const STATUS_TABS = [
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "", label: "All" },
];

/**
 * The leave requests waiting on the signed-in approver.
 *
 * A lead sees the requests their team raised; an admin sees the leads' own
 * requests (nobody sits above a lead), and can widen to every request in the
 * organisation. The server decides which of those the caller gets — this page
 * only asks.
 */
function ApprovalQueue() {
  const { isAdmin } = useAuth();
  const { addNotification } = useNotifications();

  const [status, setStatus] = useState("pending");
  const [projectId, setProjectId] = useState("");
  const [scope, setScope] = useState("queue");

  const [requests, setRequests] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    getProjectOptions()
      .then(setProjects)
      .catch(() => {
        // The project filter is optional; the queue below still works without it.
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRequests(
        await getApprovalQueue({
          status: status || null,
          projectId: projectId || null,
          scope: isAdmin ? scope : null,
        }),
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [status, projectId, scope, isAdmin]);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (request, action, reason) => {
    setBusyId(request.id);
    const name = fullName(
      request.employee_first_name,
      request.employee_last_name,
    );
    try {
      if (action === "approve") {
        await approveLeaveRequest(request.id);
        toast.success(`${name}'s leave approved.`);
        addNotification({
          type: "success",
          title: "Leave approved",
          body: `${name}'s leave was approved and marked on their attendance.`,
        });
      } else {
        await rejectLeaveRequest(request.id, reason);
        toast.success(`${name}'s leave rejected.`);
        addNotification({
          type: "warning",
          title: "Leave rejected",
          body: `${name} was told why their request could not be approved.`,
        });
      }
      await load();
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Unable to record that decision.",
      );
    } finally {
      setBusyId(null);
    }
  };

  const pendingCount = requests.filter((r) => r.status === "pending").length;

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Leave approvals
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {isAdmin
            ? scope === "all"
              ? "Every leave request across the organisation"
              : "Requests raised by your leads — employees' requests go to their own lead"
            : "Requests raised by the people who report to you"}
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div
            role="tablist"
            aria-label="Filter by status"
            className="inline-flex w-fit rounded-lg border border-line bg-surface p-0.5 shadow-sm"
          >
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value || "all"}
                type="button"
                role="tab"
                aria-selected={status === tab.value}
                onClick={() => setStatus(tab.value)}
                className={cn(
                  "h-8 rounded-md px-3 text-xs font-medium transition-colors",
                  status === tab.value
                    ? "bg-primary text-white shadow-sm"
                    : "text-muted hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-end gap-3">
            {isAdmin && (
              <Select
                label="Show"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="min-w-[13rem]"
              >
                <option value="queue">My queue (leads' requests)</option>
                <option value="all">Everyone's requests</option>
              </Select>
            )}
            <Select
              label="Project"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="min-w-[12rem]"
            >
              <option value="">All projects</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </Card>

      {error ? (
        <ErrorState
          title="Couldn't load the queue"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching leave requests."
          }
          onRetry={load}
        />
      ) : loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 rounded-xl" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <Card>
          <EmptyState
            icon={status === "pending" ? CalendarCheck : Inbox}
            title={
              status === "pending"
                ? "Nothing waiting on you"
                : "No requests here"
            }
            description={
              status === "pending"
                ? "Every request routed to you has been decided."
                : "Try another status or project filter."
            }
          />
        </Card>
      ) : (
        <>
          {pendingCount > 0 && (
            <p className="px-1 text-xs font-medium text-muted" aria-live="polite">
              {pendingCount} awaiting your decision
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            {requests.map((request) => (
              <LeaveRequestCard
                key={request.id}
                request={request}
                canDecide
                busy={busyId === request.id}
                onApprove={(r) => decide(r, "approve")}
                onReject={(r, reason) => decide(r, "reject", reason)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default ApprovalQueue;
