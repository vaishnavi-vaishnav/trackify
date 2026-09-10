import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Mail, Pencil, Plus, Trash2, UserPlus, Users } from "lucide-react";
import { toast } from "react-toastify";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { FilterChips } from "../../components/ui/FilterChips";
import { IconButton } from "../../components/ui/IconButton";
import { Modal } from "../../components/ui/Modal";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Skeleton } from "../../components/ui/Skeleton";
import { StatusBadge } from "../../components/ui/StatusBadge";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/Table";
import { PageHeader, Toolbar } from "../../components/layout/PageHeader";
import { PersonFormModal } from "../../components/forms/PersonFormModal";
import { useNotifications } from "../../context/NotificationContext";
import {
  deleteEmployee,
  getEmployees,
  toggleEmployeeStatus,
} from "../../services/admin";
import { sendActivationLink } from "../../services/auth";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { fullName } from "../../lib/format";
import { roleLabels, roleTones } from "../../lib/status";

const PAGE_SIZE = 20;

const capitalize = (word) => word.charAt(0).toUpperCase() + word.slice(1);

function Employees() {
  const navigate = useNavigate();
  const { addNotification } = useNotifications();
  // Other pages deep-link here — "Add person" from Leads & Teams, and the
  // unassigned-employees warning — so those intents arrive as query params.
  const [params, setParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [role, setRole] = useState("all");
  const [status, setStatus] = useState("all");
  const [unassignedOnly, setUnassignedOnly] = useState(
    params.get("unassigned") === "1",
  );
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [people, setPeople] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [formOpen, setFormOpen] = useState(
    params.get("new") === "1" || params.has("edit"),
  );
  const [editingId, setEditingId] = useState(params.get("edit"));
  const [confirmToggle, setConfirmToggle] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [sendingLink, setSendingLink] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, role, status, unassignedOnly]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getEmployees({
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(role !== "all" ? { role } : {}),
        ...(status !== "all" ? { status } : {}),
        ...(unassignedOnly ? { unassigned: true } : {}),
      });
      setPeople(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, role, status, unassignedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setFormOpen(true);
  };

  const openEdit = (person) => {
    setEditingId(person.employee_id);
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingId(null);
    // Clear the deep-link intent so a refresh does not reopen the dialog.
    if (params.has("new") || params.has("edit")) {
      params.delete("new");
      params.delete("edit");
      setParams(params, { replace: true });
    }
  };

  const clearFilters = () => {
    setSearch("");
    setRole("all");
    setStatus("all");
    setUnassignedOnly(false);
    if (params.has("unassigned")) {
      params.delete("unassigned");
      setParams(params, { replace: true });
    }
  };

  const performToggle = async () => {
    if (!confirmToggle) return;
    const { person, action } = confirmToggle;
    setBusyId(person.employee_id);
    try {
      const res = await toggleEmployeeStatus(person.employee_id);
      const name = fullName(person.first_name, person.last_name);
      toast.success(res.message || `${name} ${action}d.`);
      addNotification({
        type: action === "deactivate" ? "warning" : "success",
        title: `Account ${action}d`,
        body: `${name} (${person.employee_id}) is now ${action === "deactivate" ? "inactive" : "active"}.`,
      });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to update this account.");
    } finally {
      setBusyId(null);
      setConfirmToggle(null);
    }
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    const person = confirmDelete;
    setBusyId(person.employee_id);
    try {
      const name = fullName(person.first_name, person.last_name);
      await deleteEmployee(person.employee_id);
      toast.success(`${name} was removed.`);
      addNotification({
        type: "warning",
        title: "Person removed",
        body: `${name} (${person.employee_id}) was deleted along with their records.`,
      });
      await load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Unable to delete this account.");
    } finally {
      setBusyId(null);
      setConfirmDelete(null);
    }
  };

  const handleSendActivationLink = async (person) => {
    setSendingLink(person.employee_id);
    try {
      const res = await sendActivationLink(person.employee_id);
      toast.success(res.message || "Activation link sent.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Unable to send the activation link.",
      );
    } finally {
      setSendingLink(null);
    }
  };

  const counts = meta?.counts;
  const filtersActive =
    Boolean(debouncedSearch) ||
    role !== "all" ||
    status !== "all" ||
    unassignedOnly;

  const toggleAction = confirmToggle?.action ?? "deactivate";
  const toggleName = confirmToggle
    ? fullName(confirmToggle.person.first_name, confirmToggle.person.last_name)
    : "";
  const deleteName = confirmDelete
    ? fullName(confirmDelete.first_name, confirmDelete.last_name)
    : "";

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="People"
        description="Everyone in Trackify — employees, leads and admins"
        actions={
          <Button onClick={openCreate} leftIcon={Plus}>
            Add person
          </Button>
        }
      />

      <Toolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search name, ID, email…"
            label="Search people"
          />
        }
      >
        <FilterChips
          label="Filter by role"
          value={role}
          onChange={setRole}
          options={[
            { value: "all", label: "All", count: counts?.total },
            { value: "employee", label: "Employees", count: counts?.employees },
            { value: "lead", label: "Leads", count: counts?.leads },
            { value: "admin", label: "Admins", count: counts?.admins },
          ]}
        />
        <FilterChips
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "all", label: "Any" },
            { value: "active", label: "Active", count: counts?.active },
            { value: "pending", label: "Pending", count: counts?.pending },
            { value: "inactive", label: "Inactive", count: counts?.inactive },
          ]}
        />
        {counts?.unassigned > 0 && (
          <FilterChips
            label="Filter by lead assignment"
            value={unassignedOnly}
            onChange={setUnassignedOnly}
            options={[
              { value: false, label: "Any lead" },
              { value: true, label: "No lead", count: counts.unassigned },
            ]}
          />
        )}
      </Toolbar>

      {error ? (
        <ErrorState
          title="Couldn't load your people"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching the directory."
          }
          onRetry={load}
        />
      ) : loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : people.length === 0 ? (
        <Card>
          <EmptyState
            icon={filtersActive ? Users : UserPlus}
            title={filtersActive ? "No matches" : "Nobody here yet"}
            description={
              filtersActive
                ? "Try a different search term or filter."
                : "Add your first person to start building your organisation."
            }
            action={
              filtersActive ? (
                <Button variant="outline" size="sm" onClick={clearFilters}>
                  Clear filters
                </Button>
              ) : (
                <Button onClick={openCreate} leftIcon={Plus}>
                  Add person
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <Table>
            <THead>
              <Tr>
                <Th>Person</Th>
                <Th>Role</Th>
                <Th>Reports to</Th>
                <Th>Projects</Th>
                <Th>Status</Th>
                <Th className="text-right">Actions</Th>
              </Tr>
            </THead>
            <TBody>
              {people.map((person) => {
                const name = fullName(person.first_name, person.last_name);
                const pending = person.account_status === "pending";
                const busy = busyId === person.employee_id;
                const projects = person.projects ?? [];

                return (
                  <Tr key={person.employee_id}>
                    <Td>
                      <div className="flex items-center gap-3">
                        <Avatar name={name} size="md" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink">
                            {name}
                          </p>
                          <p className="truncate text-xs tabular text-muted">
                            {person.employee_id}
                            {person.designation ? ` · ${person.designation}` : ""}
                          </p>
                        </div>
                      </div>
                    </Td>

                    <Td>
                      <div className="flex items-center gap-2">
                        <Badge tone={roleTones[person.role] ?? "neutral"}>
                          {roleLabels[person.role] ?? person.role}
                        </Badge>
                        {person.role === "lead" && (
                          <button
                            type="button"
                            onClick={() => navigate(`/admin/leads/${person.id}`)}
                            className="text-xs text-muted underline-offset-2 hover:text-primary hover:underline"
                          >
                            {person.team_size} in team
                          </button>
                        )}
                      </div>
                    </Td>

                    <Td className="text-muted">
                      {person.lead_first_name ? (
                        fullName(person.lead_first_name, person.lead_last_name)
                      ) : person.role === "employee" ? (
                        <Badge tone="warning">No lead</Badge>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </Td>

                    <Td>
                      {projects.length ? (
                        <div className="flex flex-wrap gap-1">
                          {projects.slice(0, 2).map((p) => (
                            <Badge key={p.id} tone="neutral">
                              {p.name}
                            </Badge>
                          ))}
                          {projects.length > 2 && (
                            <Badge tone="muted">+{projects.length - 2}</Badge>
                          )}
                        </div>
                      ) : (
                        <span className="text-faint">—</span>
                      )}
                    </Td>

                    <Td>
                      <StatusBadge status={person.account_status} />
                    </Td>

                    <Td>
                      <div className="flex items-center justify-end gap-2">
                        {pending ? (
                          <Button
                            variant="primary"
                            size="sm"
                            loading={sendingLink === person.employee_id}
                            onClick={() => handleSendActivationLink(person)}
                            leftIcon={Mail}
                          >
                            Send link
                          </Button>
                        ) : (
                          <Button
                            variant={
                              person.account_status === "active"
                                ? "dangerSubtle"
                                : "outline"
                            }
                            size="sm"
                            loading={busy}
                            onClick={() =>
                              setConfirmToggle({
                                person,
                                action:
                                  person.account_status === "active"
                                    ? "deactivate"
                                    : "activate",
                              })
                            }
                          >
                            {person.account_status === "active"
                              ? "Deactivate"
                              : "Activate"}
                          </Button>
                        )}
                        <IconButton
                          icon={Pencil}
                          label={`Edit ${name}`}
                          variant="solid"
                          size="sm"
                          onClick={() => openEdit(person)}
                        />
                        <IconButton
                          icon={Trash2}
                          label={`Delete ${name}`}
                          variant="ghost"
                          size="sm"
                          className="text-danger hover:bg-danger-soft"
                          onClick={() => setConfirmDelete(person)}
                        />
                      </div>
                    </Td>
                  </Tr>
                );
              })}
            </TBody>
          </Table>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            onChange={setPage}
            label="people"
          />
        </>
      )}

      <PersonFormModal
        open={formOpen}
        onClose={closeForm}
        employeeId={editingId}
        onSaved={load}
      />

      <Modal
        open={Boolean(confirmToggle)}
        onClose={() => setConfirmToggle(null)}
        size="sm"
        title={confirmToggle ? `${capitalize(toggleAction)} ${toggleName}?` : ""}
        description="This changes their access to Trackify."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmToggle(null)}>
              Cancel
            </Button>
            <Button
              variant={toggleAction === "deactivate" ? "danger" : "primary"}
              loading={busyId === confirmToggle?.person?.employee_id}
              onClick={performToggle}
            >
              {capitalize(toggleAction)}
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {toggleAction === "deactivate"
            ? `${toggleName} will be signed out and cannot sign in again until reactivated. Their attendance history is kept.`
            : `${toggleName} will be able to sign in with their existing password.`}
        </p>
      </Modal>

      <Modal
        open={Boolean(confirmDelete)}
        onClose={() => setConfirmDelete(null)}
        size="sm"
        title={confirmDelete ? `Delete ${deleteName}?` : ""}
        description="This cannot be undone."
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyId === confirmDelete?.employee_id}
              onClick={performDelete}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {deleteName}'s account, attendance records and leave history will be
          removed for good. To keep their history instead, deactivate the
          account.
        </p>
      </Modal>
    </div>
  );
}

export default Employees;
