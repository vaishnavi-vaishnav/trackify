import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  BarChart3,
  Building2,
  Pencil,
  Plus,
  Trash2,
  UserMinus,
  Users,
  Users2,
  X,
} from "lucide-react";
import { toast } from "react-toastify";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { IconButton } from "../../components/ui/IconButton";
import { Input } from "../../components/ui/Input";
import { Modal } from "../../components/ui/Modal";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatCard } from "../../components/ui/StatCard";
import { PageHeader } from "../../components/layout/PageHeader";
import { ProjectFormModal } from "../../components/projects/ProjectFormModal";
import {
  assignLeadToProject,
  createDepartment,
  deleteDepartment,
  deleteProject,
  getProject,
  removeLeadFromProject,
} from "../../services/projects";
import { getLeadOptions } from "../../services/leads";
import { fullName, monthKey } from "../../lib/format";

/**
 * Everything about one project: its leads, the people reached through them,
 * and its departments.
 *
 * A dedicated route rather than a panel beside the list — it keeps the list
 * page light no matter how many projects exist, and makes a project linkable.
 */
function ProjectDetail() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [leadOptions, setLeadOptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [leadToAdd, setLeadToAdd] = useState("");
  const [departmentName, setDepartmentName] = useState("");
  const [peopleQuery, setPeopleQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setProject(await getProject(projectId));
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    getLeadOptions()
      .then(setLeadOptions)
      .catch(() => {
        // The assign picker is optional; the rest of the page still works.
      });
  }, []);

  const run = async (action, successMessage, failureMessage) => {
    setBusy(true);
    try {
      await action();
      if (successMessage) toast.success(successMessage);
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || failureMessage);
    } finally {
      setBusy(false);
    }
  };

  const removeProject = async () => {
    setBusy(true);
    try {
      await deleteProject(project.id);
      toast.success("Project deleted.");
      navigate("/admin/projects");
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to delete this project.");
      setBusy(false);
    }
  };

  if (loading && !project) {
    return (
      <div className="space-y-5" aria-busy="true">
        <Skeleton className="h-10 w-64" />
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  if (error || !project) {
    return (
      <ErrorState
        title="Couldn't load this project"
        description={
          error?.response?.data?.message ||
          "It may have been deleted, or your session expired."
        }
        onRetry={load}
      />
    );
  }

  const assignedLeadIds = new Set(project.leads.map((l) => l.lead_id));
  const availableLeads = leadOptions.filter((l) => !assignedLeadIds.has(l.id));

  const q = peopleQuery.trim().toLowerCase();
  const people = q
    ? project.employees.filter((e) =>
        [e.first_name, e.last_name, e.employee_id, e.designation]
          .join(" ")
          .toLowerCase()
          .includes(q),
      )
    : project.employees;

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        backTo="/admin/projects"
        backLabel="All projects"
        title={project.name}
        description={project.description || "No description"}
        actions={
          <>
            <Button
              variant="outline"
              leftIcon={BarChart3}
              onClick={() =>
                navigate(
                  `/admin/reports?projectId=${project.id}&month=${monthKey()}`,
                )
              }
            >
              View report
            </Button>
            <IconButton
              icon={Pencil}
              label="Edit project"
              variant="solid"
              onClick={() => setEditing(true)}
            />
            <IconButton
              icon={Trash2}
              label="Delete project"
              variant="ghost"
              className="text-danger hover:bg-danger-soft"
              onClick={() => setConfirmDelete(true)}
            />
          </>
        }
      />

      <section className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Status"
          value={project.status === "active" ? "Active" : "Archived"}
          icon={Building2}
          tone={project.status === "active" ? "success" : "neutral"}
        />
        <StatCard
          label="Leads"
          value={project.leads.length}
          icon={Users2}
          tone="primary"
          hint="Running this project"
        />
        <StatCard
          label="People"
          value={project.employees.length}
          icon={Users}
          tone="info"
          hint="Across all its teams"
        />
        <StatCard
          label="Departments"
          value={project.departments.length}
          icon={Building2}
          tone="neutral"
          hint="Optional groupings"
        />
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card className="flex flex-col p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Leads</h2>
            <p className="mt-0.5 text-xs text-muted">
              A project can run with several leads, each owning their own team
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Select
              label="Assign a lead"
              value={leadToAdd}
              onChange={(e) => setLeadToAdd(e.target.value)}
              className="min-w-[13rem]"
              disabled={availableLeads.length === 0}
            >
              <option value="">
                {availableLeads.length
                  ? "Select a lead…"
                  : "Every lead is already assigned"}
              </option>
              {availableLeads.map((lead) => (
                <option key={lead.id} value={lead.id}>
                  {fullName(lead.first_name, lead.last_name)} ({lead.employee_id})
                </option>
              ))}
            </Select>
            <Button
              onClick={() =>
                run(
                  async () => {
                    await assignLeadToProject(project.id, Number(leadToAdd));
                    setLeadToAdd("");
                  },
                  "Lead assigned to the project.",
                  "Unable to assign this lead.",
                )
              }
              disabled={!leadToAdd}
              loading={busy}
              leftIcon={Plus}
            >
              Assign
            </Button>
          </div>

          {project.leads.length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No leads yet"
              description="Assign a lead so their team's work is tracked against this project."
            />
          ) : (
            <ul className="mt-4 divide-y divide-line border-t border-line">
              {project.leads.map((lead) => {
                const name = fullName(lead.first_name, lead.last_name);
                return (
                  <li key={lead.lead_id} className="flex items-center gap-3 py-3">
                    <Avatar name={name} size="md" />
                    <button
                      type="button"
                      onClick={() => navigate(`/admin/leads/${lead.lead_id}`)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <p className="truncate text-sm font-medium text-ink hover:text-primary">
                        {name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {lead.employee_count} employee
                        {Number(lead.employee_count) === 1 ? "" : "s"}
                        {lead.department_name ? ` · ${lead.department_name}` : ""}
                      </p>
                    </button>
                    <IconButton
                      icon={UserMinus}
                      label={`Remove ${name} from ${project.name}`}
                      variant="ghost"
                      size="sm"
                      className="text-danger hover:bg-danger-soft"
                      onClick={() =>
                        run(
                          () => removeLeadFromProject(project.id, lead.lead_id),
                          "Lead removed from the project.",
                          "Unable to remove this lead.",
                        )
                      }
                    />
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <div>
            <h2 className="text-sm font-semibold text-ink">Departments</h2>
            <p className="mt-0.5 text-xs text-muted">
              Optional groupings within this project
            </p>
          </div>

          <div className="mt-4 flex flex-wrap items-end gap-3">
            <Input
              label="New department"
              value={departmentName}
              onChange={(e) => setDepartmentName(e.target.value)}
              placeholder="e.g. Platform"
              className="min-w-[13rem]"
            />
            <Button
              onClick={() =>
                run(
                  async () => {
                    await createDepartment(project.id, departmentName.trim());
                    setDepartmentName("");
                  },
                  null,
                  "Unable to add this department.",
                )
              }
              disabled={!departmentName.trim()}
              loading={busy}
              leftIcon={Plus}
            >
              Add
            </Button>
          </div>

          {project.departments.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="No departments"
              description="Add one if you want to group this project's leads."
            />
          ) : (
            <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
              {project.departments.map((department) => (
                <span
                  key={department.id}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-medium text-ink-soft"
                >
                  {department.name}
                  <button
                    type="button"
                    aria-label={`Remove ${department.name}`}
                    onClick={() =>
                      run(
                        () => deleteDepartment(project.id, department.id),
                        null,
                        "Unable to remove this department.",
                      )
                    }
                    className="grid h-5 w-5 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                  >
                    <X className="h-3 w-3" aria-hidden="true" />
                  </button>
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-semibold text-ink">
              People on this project
            </h2>
            <p className="mt-0.5 text-xs text-muted">
              Everyone reporting to one of its leads
            </p>
          </div>
          {project.employees.length > 6 && (
            <SearchInput
              value={peopleQuery}
              onChange={setPeopleQuery}
              placeholder="Find someone…"
              label="Search people on this project"
              className="w-full sm:w-64"
            />
          )}
        </div>

        {people.length === 0 ? (
          <EmptyState
            icon={Users}
            title={peopleQuery ? "Nobody matches" : "Nobody yet"}
            description={
              peopleQuery
                ? "Try a different search term."
                : "Assign employees to this project's leads from Leads & Teams."
            }
          />
        ) : (
          <ul className="mt-4 grid gap-2 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-3">
            {people.map((employee) => {
              const name = fullName(employee.first_name, employee.last_name);
              return (
                <li
                  key={employee.id}
                  className="flex items-center gap-3 rounded-lg border border-line px-3 py-2.5"
                >
                  <Avatar name={name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">
                      {name}
                    </p>
                    <p className="truncate text-xs text-muted">
                      under{" "}
                      {fullName(
                        employee.lead_first_name,
                        employee.lead_last_name,
                      )}
                    </p>
                  </div>
                  {employee.account_status !== "active" && (
                    <Badge tone="muted">{employee.account_status}</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <ProjectFormModal
        open={editing}
        onClose={() => setEditing(false)}
        project={project}
        onSaved={() => {
          toast.success("Project updated.");
          load();
        }}
      />

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        size="sm"
        title={`Delete ${project.name}?`}
        description="This cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={removeProject}>
              Delete project
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          Attendance and leave already booked against {project.name} is kept, but
          loses its project label. To keep the history intact, archive the
          project instead.
        </p>
      </Modal>
    </div>
  );
}

export default ProjectDetail;
