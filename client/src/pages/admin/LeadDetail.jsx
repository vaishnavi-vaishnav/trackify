import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BarChart3,
  FolderKanban,
  Pencil,
  UserMinus,
  UserPlus,
  Users2,
} from "lucide-react";
import { toast } from "react-toastify";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { IconButton } from "../../components/ui/IconButton";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { PageHeader } from "../../components/layout/PageHeader";
import {
  assignEmployeeToLead,
  getLead,
  removeEmployeeFromLead,
} from "../../services/leads";
import { getEmployees } from "../../services/admin";
import { fullName, monthKey } from "../../lib/format";

/** One lead: their team, their projects, and the controls to change both. */
function LeadDetail() {
  const { leadId } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [unassigned, setUnassigned] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [employeeToAdd, setEmployeeToAdd] = useState("");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, pool] = await Promise.all([
        getLead(leadId),
        // Employees with no lead are the pool this team can draw from.
        getEmployees({ unassigned: true, pageSize: "all" }),
      ]);
      setLead(detail);
      setUnassigned(pool.data);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const run = async (action, successMessage, failureMessage) => {
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || failureMessage);
    } finally {
      setBusy(false);
    }
  };

  if (loading && !lead) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !lead) {
    return (
      <ErrorState
        title="Couldn't load this team"
        description={
          error?.response?.data?.message ||
          "The lead may have been removed, or your session expired."
        }
        onRetry={load}
      />
    );
  }

  const name = fullName(lead.first_name, lead.last_name);
  const q = query.trim().toLowerCase();
  const team = q
    ? lead.employees.filter((e) =>
        [e.first_name, e.last_name, e.employee_id, e.designation]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : lead.employees;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        backTo="/admin/leads"
        backLabel="All leads"
        title={`${name}'s team`}
        description={`${lead.email}${lead.department ? ` · ${lead.department}` : ""}`}
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={BarChart3}
              onClick={() =>
                navigate(`/admin/reports?leadId=${lead.id}&month=${monthKey()}`)
              }
            >
              View report
            </Button>
            <IconButton
              icon={Pencil}
              label={`Edit ${name}`}
              variant="solid"
              onClick={() =>
                navigate(`/admin/employees?edit=${lead.employee_id}`)
              }
            />
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-3">
        <StatCard
          label="Team size"
          value={lead.employees.length}
          icon={Users2}
          tone="primary"
          hint="Direct reports"
        />
        <StatCard
          label="Projects"
          value={lead.projects.length}
          icon={FolderKanban}
          tone="info"
          hint="This lead runs"
        />
        <StatCard
          label="Available to assign"
          value={unassigned.length}
          icon={UserPlus}
          tone={unassigned.length ? "warning" : "neutral"}
          hint="Employees with no lead"
        />
      </section>

      {lead.projects.length > 0 && (
        <Card className="flex flex-wrap items-center gap-2 p-4">
          <span className="text-xs font-medium text-muted">Projects:</span>
          {lead.projects.map((project) => (
            <button
              key={project.id}
              type="button"
              onClick={() => navigate(`/admin/projects/${project.id}`)}
            >
              <Badge tone="info">{project.name}</Badge>
            </button>
          ))}
        </Card>
      )}

      <Card className="p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">Team members</h2>
            <p className="mt-0.5 text-xs text-muted">
              Their leave requests come to {name} for approval
            </p>
          </div>
          {lead.employees.length > 6 && (
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Find someone…"
              label="Search this team"
              className="w-full sm:w-64"
            />
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-end gap-3 border-t border-line pt-4">
          <Select
            label="Add an employee to this team"
            value={employeeToAdd}
            onChange={(e) => setEmployeeToAdd(e.target.value)}
            className="min-w-[16rem]"
            disabled={unassigned.length === 0}
            hint={
              unassigned.length === 0
                ? "Everyone already reports to a lead"
                : undefined
            }
          >
            <option value="">
              {unassigned.length
                ? "Select an employee…"
                : "No unassigned employees"}
            </option>
            {unassigned.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {fullName(employee.first_name, employee.last_name)} (
                {employee.employee_id})
              </option>
            ))}
          </Select>
          <Button
            onClick={() =>
              run(
                async () => {
                  await assignEmployeeToLead(lead.id, Number(employeeToAdd));
                  setEmployeeToAdd("");
                },
                "Employee assigned.",
                "Unable to assign this employee.",
              )
            }
            disabled={!employeeToAdd}
            loading={busy}
            leftIcon={UserPlus}
          >
            Assign
          </Button>
        </div>

        {team.length === 0 ? (
          <EmptyState
            icon={Users2}
            title={query ? "Nobody matches" : "No one on this team yet"}
            description={
              query
                ? "Try a different search term."
                : "Assign an employee above so their leave routes to this lead."
            }
          />
        ) : (
          <ul className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2">
            {team.map((employee) => {
              const memberName = fullName(
                employee.first_name,
                employee.last_name,
              );
              return (
                <li
                  key={employee.id}
                  className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
                >
                  <Avatar name={memberName} size="md" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink">
                      {memberName}
                    </p>
                    <p className="truncate text-xs text-muted">
                      {employee.employee_id}
                      {employee.designation ? ` · ${employee.designation}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={employee.account_status} />
                  <IconButton
                    icon={UserMinus}
                    label={`Remove ${memberName} from this team`}
                    variant="ghost"
                    size="sm"
                    className="text-danger hover:bg-danger-soft"
                    onClick={() =>
                      run(
                        () => removeEmployeeFromLead(lead.id, employee.id),
                        "Employee removed from this team.",
                        "Unable to remove this employee.",
                      )
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export default LeadDetail;
