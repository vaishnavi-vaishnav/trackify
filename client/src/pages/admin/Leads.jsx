import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, UserPlus, Users2 } from "lucide-react";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Select } from "../../components/ui/Select";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader, Toolbar } from "../../components/layout/PageHeader";
import { getLeads } from "../../services/leads";
import { getProjectOptions } from "../../services/projects";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { fullName } from "../../lib/format";

const PAGE_SIZE = 12;

/** One lead as a card: who they are, how big their team is, what they run. */
function LeadCard({ lead, onOpen }) {
  const name = fullName(lead.first_name, lead.last_name);
  const projects = lead.projects ?? [];

  return (
    <Card as="button" hover onClick={onOpen} className="w-full p-5 text-left">
      <div className="flex items-start gap-3">
        <Avatar name={name} size="lg" />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-ink">{name}</h3>
          <p className="truncate text-xs tabular text-muted">
            {lead.employee_id}
            {lead.department ? ` · ${lead.department}` : ""}
          </p>
        </div>
        <Badge tone={lead.employee_count ? "primary" : "warning"}>
          {lead.employee_count}
        </Badge>
      </div>

      <p className="mt-3 text-xs text-muted">
        {lead.employee_count === 0 ? (
          <span className="text-warning">No team assigned yet</span>
        ) : (
          `${lead.employee_count} employee${Number(lead.employee_count) === 1 ? "" : "s"} reporting`
        )}
      </p>

      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
        {projects.length ? (
          projects.map((project) => (
            <Badge key={project.id} tone="info">
              {project.name}
            </Badge>
          ))
        ) : (
          <span className="text-xs text-faint">On no project yet</span>
        )}
      </div>
    </Card>
  );
}

/**
 * Who reports to whom. A lead's team is the unit every other view keys off:
 * their leave approvals, their team attendance, and the lead-wise reports.
 */
function Leads() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [projectId, setProjectId] = useState("");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [leads, setLeads] = useState([]);
  const [meta, setMeta] = useState(null);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, projectId]);

  useEffect(() => {
    getProjectOptions()
      .then(setProjects)
      .catch(() => {
        // Optional filter; the grid below still loads without it.
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getLeads({
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(projectId ? { projectId } : {}),
      });
      setLeads(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = meta?.counts;
  const filtersActive = Boolean(debouncedSearch) || Boolean(projectId);

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Leads & Teams"
        description="Assign employees to the lead who approves their leave and reviews their attendance"
        actions={
          <Button onClick={() => navigate("/admin/employees?new=1")} leftIcon={Plus}>
            Add person
          </Button>
        }
      />

      {counts?.unassigned_employees > 0 && (
        <Card className="flex flex-wrap items-center justify-between gap-3 border-warning/30 bg-warning-soft/40 p-4">
          <p className="text-[13px] text-ink-soft">
            <span className="font-semibold">
              {counts.unassigned_employees} employee
              {counts.unassigned_employees === 1 ? "" : "s"} have no lead.
            </span>{" "}
            They cannot submit leave until someone is responsible for approving
            it.
          </p>
          <Button
            size="sm"
            variant="outline"
            leftIcon={UserPlus}
            onClick={() => navigate("/admin/employees?unassigned=1")}
          >
            Review them
          </Button>
        </Card>
      )}

      <Toolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search leads…"
            label="Search leads"
          />
        }
      >
        <Select
          aria-label="Filter by project"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="min-w-[13rem]"
        >
          <option value="">All projects</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </Select>
      </Toolbar>

      {error ? (
        <ErrorState
          title="Couldn't load leads"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching your leads."
          }
          onRetry={load}
        />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : leads.length === 0 ? (
        <Card>
          <EmptyState
            icon={Users2}
            title={filtersActive ? "No leads match" : "No leads yet"}
            description={
              filtersActive
                ? "Try a different search term or project."
                : "Add a person with the Lead role, then assign employees to them."
            }
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setProjectId("");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button
                  onClick={() => navigate("/admin/employees?new=1")}
                  leftIcon={Plus}
                >
                  Add a lead
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {leads.map((lead) => (
              <LeadCard
                key={lead.id}
                lead={lead}
                onOpen={() => navigate(`/admin/leads/${lead.id}`)}
              />
            ))}
          </div>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            onChange={setPage}
            label="leads"
          />
        </>
      )}
    </div>
  );
}

export default Leads;
