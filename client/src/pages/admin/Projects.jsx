import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FolderKanban, Plus, Users, Users2 } from "lucide-react";
import { toast } from "react-toastify";
import { Avatar } from "../../components/ui/Avatar";
import { Badge } from "../../components/ui/Badge";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { FilterChips } from "../../components/ui/FilterChips";
import { Pagination } from "../../components/ui/Pagination";
import { SearchInput } from "../../components/ui/SearchInput";
import { Skeleton } from "../../components/ui/Skeleton";
import { PageHeader, Toolbar } from "../../components/layout/PageHeader";
import { ProjectFormModal } from "../../components/projects/ProjectFormModal";
import { getProjects } from "../../services/projects";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { fullName } from "../../lib/format";
import { cn } from "../../lib/utils";

const PAGE_SIZE = 12;

/**
 * One project as a card. The whole card navigates to the project; the counts
 * give a sense of its size without opening it.
 */
function ProjectCard({ project, onOpen }) {
  const leads = project.leads ?? [];
  const archived = project.status !== "active";

  return (
    <Card
      as="button"
      hover
      onClick={onOpen}
      className={cn(
        "flex w-full flex-col p-5 text-left",
        archived && "opacity-70",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-ink">
            {project.name}
          </h3>
          <p className="mt-1 line-clamp-2 min-h-[2.5rem] text-[13px] leading-relaxed text-muted">
            {project.description || "No description"}
          </p>
        </div>
        {archived && <Badge tone="muted">Archived</Badge>}
      </div>

      <div className="mt-4 flex items-center gap-4 border-t border-line pt-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <Users2 className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-semibold tabular text-ink">
            {project.lead_count}
          </span>
          lead{Number(project.lead_count) === 1 ? "" : "s"}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="font-semibold tabular text-ink">
            {project.employee_count}
          </span>
          {Number(project.employee_count) === 1 ? "person" : "people"}
        </span>
      </div>

      {leads.length > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {leads.slice(0, 4).map((lead) => (
              <Avatar
                key={lead.id}
                name={fullName(lead.firstName, lead.lastName)}
                size="xs"
                className="ring-2 ring-surface"
              />
            ))}
          </div>
          <p className="truncate text-xs text-muted">
            {leads
              .slice(0, 2)
              .map((l) => fullName(l.firstName, l.lastName))
              .join(", ")}
            {leads.length > 2 && ` +${leads.length - 2}`}
          </p>
        </div>
      ) : (
        <p className="mt-3 text-xs text-warning">No leads assigned yet</p>
      )}
    </Card>
  );
}

function Projects() {
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search, 300);

  const [projects, setProjects] = useState([]);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Any change to a filter invalidates the current page number.
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProjects({
        page,
        pageSize: PAGE_SIZE,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
        ...(status !== "all" ? { status } : {}),
      });
      setProjects(res.data);
      setMeta(res.meta);
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = meta?.counts;
  const filtersActive = Boolean(debouncedSearch) || status !== "active";

  return (
    <div className="animate-fade-up space-y-5">
      <PageHeader
        title="Projects"
        description="Each project runs with several leads, and each lead owns their own team"
        actions={
          <Button onClick={() => setCreating(true)} leftIcon={Plus}>
            New project
          </Button>
        }
      />

      <Toolbar
        search={
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search projects…"
            label="Search projects"
          />
        }
      >
        <FilterChips
          label="Filter by status"
          value={status}
          onChange={setStatus}
          options={[
            { value: "active", label: "Active", count: counts?.active },
            { value: "archived", label: "Archived", count: counts?.archived },
            { value: "all", label: "All", count: counts?.total },
          ]}
        />
      </Toolbar>

      {error ? (
        <ErrorState
          title="Couldn't load projects"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching your projects."
          }
          onRetry={load}
        />
      ) : loading ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <Card>
          <EmptyState
            icon={FolderKanban}
            title={filtersActive ? "No projects match" : "No projects yet"}
            description={
              filtersActive
                ? "Try a different search term or status."
                : "Create your first project, then assign leads to it."
            }
            action={
              filtersActive ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSearch("");
                    setStatus("active");
                  }}
                >
                  Clear filters
                </Button>
              ) : (
                <Button onClick={() => setCreating(true)} leftIcon={Plus}>
                  New project
                </Button>
              )
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={() => navigate(`/admin/projects/${project.id}`)}
              />
            ))}
          </div>

          <Pagination
            page={meta.page}
            totalPages={meta.totalPages}
            total={meta.total}
            pageSize={meta.pageSize}
            onChange={setPage}
            label="projects"
          />
        </>
      )}

      <ProjectFormModal
        open={creating}
        onClose={() => setCreating(false)}
        onSaved={(project) => {
          toast.success("Project created.");
          navigate(`/admin/projects/${project.id}`);
        }}
      />
    </div>
  );
}

export default Projects;
