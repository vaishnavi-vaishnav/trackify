import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarDays, ChevronLeft, ChevronRight, Users2 } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { IconButton } from "../../components/ui/IconButton";
import { Input } from "../../components/ui/Input";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/Table";
import { useAuth } from "../../context/AuthContext";
import { getTeamAttendance } from "../../services/attendance";
import { getLeadProjects } from "../../services/leads";
import { formatDateLong, fullName, toISODate } from "../../lib/format";

/** Shift an ISO date by whole days, staying in local time. */
function shiftDate(iso, days) {
  const [y, m, d] = iso.split("-").map(Number);
  return toISODate(new Date(y, m - 1, d + days));
}

/**
 * One day across a lead's team.
 *
 * Read-only by design: everyone is in the office unless an approved request
 * moved their day, so a status is changed by deciding the request, never by
 * editing the day here.
 */
function TeamAttendance() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = toISODate();

  const [workDate, setWorkDate] = useState(today);
  const [projectId, setProjectId] = useState("");
  const [projects, setProjects] = useState([]);
  const [team, setTeam] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?.id) return;
    getLeadProjects(user.id)
      .then(setProjects)
      .catch(() => {
        // Optional filter — the table below still loads without it.
      });
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTeamAttendance({
        workDate,
        ...(projectId ? { projectId } : {}),
      });
      setTeam(res.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [workDate, projectId]);

  useEffect(() => {
    load();
  }, [load]);


  const away = team.filter((m) => m.status && m.status !== "wfo").length;
  const isWeekend = team.length > 0 && team.every((m) => !m.status);

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Team attendance
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          {formatDateLong(workDate)} ·{" "}
          {isWeekend
            ? "not a working day"
            : `${team.length - away} of ${team.length} in the office`}
        </p>
      </header>

      <Card className="p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex items-end gap-2">
            <IconButton
              icon={ChevronLeft}
              label="Previous day"
              variant="solid"
              onClick={() => setWorkDate(shiftDate(workDate, -1))}
            />
            <Input
              label="Date"
              type="date"
              max={today}
              value={workDate}
              onChange={(e) => setWorkDate(e.target.value)}
              className="min-w-[10rem]"
            />
            <IconButton
              icon={ChevronRight}
              label="Next day"
              variant="solid"
              disabled={workDate >= today}
              onClick={() => setWorkDate(shiftDate(workDate, 1))}
            />
            {workDate !== today && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setWorkDate(today)}
                className="mb-0.5"
              >
                Today
              </Button>
            )}
          </div>

          <Select
            label="Project"
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="min-w-[13rem]"
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

      {error ? (
        <ErrorState
          title="Couldn't load your team"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching attendance."
          }
          onRetry={load}
        />
      ) : loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : team.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users2}
            title="Nobody reports to you yet"
            description="Once an admin assigns employees to you, they appear here."
          />
        </Card>
      ) : (
        <Table>
          <THead>
            <Tr>
              <Th>Person</Th>
              <Th>Status</Th>
              <Th>Project</Th>
              <Th>Why</Th>
            </Tr>
          </THead>
          <TBody>
            {team.map((member) => {
              const name = fullName(member.first_name, member.last_name);
              return (
                <Tr key={member.id}>
                  <Td>
                    <button
                      type="button"
                      onClick={() =>
                        navigate(`/lead/reports/employee/${member.id}`)
                      }
                      className="flex items-center gap-3 text-left"
                    >
                      <Avatar name={name} size="md" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink">
                          {name}
                        </p>
                        <p className="text-xs tabular text-muted">
                          {member.employee_id}
                        </p>
                      </div>
                    </button>
                  </Td>
                  <Td>
                    {member.status ? (
                      <StatusBadge status={member.status} />
                    ) : (
                      <Badge tone="muted">Non-working day</Badge>
                    )}
                  </Td>
                  <Td className="text-muted">
                    {member.project_name || <span className="text-faint">—</span>}
                  </Td>
                  <Td className="text-muted">
                    {member.leave_request_id ? (
                      "Approved request"
                    ) : member.status === "wfo" ? (
                      <span className="text-faint">Default</span>
                    ) : (
                      <span className="text-faint">—</span>
                    )}
                  </Td>
                </Tr>
              );
            })}
          </TBody>
        </Table>
      )}

      {!loading && team.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-faint">
          <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
          Everyone is in the office by default. To change a day, decide the
          request behind it in Leave Approvals.
        </p>
      )}
    </div>
  );
}

export default TeamAttendance;
