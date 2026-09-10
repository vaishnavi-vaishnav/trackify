import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { BarChart3, FolderKanban, Search, Users, Users2 } from "lucide-react";
import { Badge } from "../../components/ui/Badge";
import { Card } from "../../components/ui/Card";
import { EmptyState } from "../../components/ui/EmptyState";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { Table, TBody, Td, Th, THead, Tr } from "../../components/ui/Table";
import { FilterBar } from "../../components/reports/FilterBar";
import {
  BreakdownTable,
  BreakdownTotals,
} from "../../components/reports/BreakdownTable";
import {
  getEmployeeBreakdown,
  getLeadBreakdown,
  getProjectBreakdown,
} from "../../services/reports";
import { getProjectOptions } from "../../services/projects";
import { getLeadOptions } from "../../services/leads";
import { fullName, monthKey, monthLabel } from "../../lib/format";
import { dayStatus, dayStatusOrder } from "../../lib/status";
import { cn } from "../../lib/utils";

const TABS = [
  { key: "employees", label: "By employee", icon: Users },
  { key: "leads", label: "By lead", icon: Users2 },
  { key: "projects", label: "By project", icon: FolderKanban },
];

/** Shared count cell: zeroes recede, real numbers carry their status colour. */
function Count({ value, tone }) {
  const n = Number(value ?? 0);
  return n ? (
    <span className="tabular font-semibold" style={{ color: tone }}>
      {n}
    </span>
  ) : (
    <span className="tabular text-faint">0</span>
  );
}

function Reports() {
  const navigate = useNavigate();
  // The dashboard links here with a lead pre-selected, so the filters read
  // their initial values from the URL and write changes back to it — which
  // also makes any filtered view shareable and survivable across a reload.
  const [params, setParams] = useSearchParams();

  const [tab, setTab] = useState(params.get("tab") ?? "employees");
  const [month, setMonth] = useState(params.get("month") ?? monthKey());
  const [projectId, setProjectId] = useState(params.get("projectId"));
  const [leadId, setLeadId] = useState(params.get("leadId"));
  const [query, setQuery] = useState("");

  const [projects, setProjects] = useState([]);
  const [leads, setLeads] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const next = { tab, month };
    if (projectId) next.projectId = projectId;
    if (leadId) next.leadId = leadId;
    setParams(next, { replace: true });
  }, [tab, month, projectId, leadId, setParams]);

  useEffect(() => {
    Promise.all([getProjectOptions(), getLeadOptions()])
      .then(([p, l]) => {
        setProjects(p);
        setLeads(l);
      })
      .catch(() => {
        // Filter options are a convenience; the report below still loads
        // without them, so a failure here should not blank the page.
      });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters = {
      month,
      ...(projectId ? { projectId } : {}),
      ...(leadId ? { leadId } : {}),
    };
    try {
      if (tab === "leads") {
        setData(await getLeadBreakdown(filters));
      } else if (tab === "projects") {
        setData(await getProjectBreakdown({ month }));
      } else {
        setData(await getEmployeeBreakdown(filters));
      }
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [tab, month, projectId, leadId]);

  useEffect(() => {
    load();
  }, [load]);

  const employees = useMemo(() => {
    const rows = data?.employees ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) =>
      [row.first_name, row.last_name, row.employee_id, row.department]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, query]);

  const selectedLead = leads.find((l) => String(l.id) === String(leadId));

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">Reports</h1>
        <p className="mt-1.5 text-sm text-muted">
          Attendance for {monthLabel(month)} — by employee, lead or project
        </p>
      </header>

      <div
        role="tablist"
        aria-label="Report view"
        className="inline-flex rounded-lg border border-line bg-surface p-0.5 shadow-sm"
      >
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-sm font-medium transition-colors",
                active
                  ? "bg-primary text-white shadow-sm"
                  : "text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      <FilterBar
        month={month}
        onMonthChange={setMonth}
        projects={projects}
        projectId={projectId}
        onProjectChange={tab === "projects" ? undefined : setProjectId}
        leads={leads}
        leadId={leadId}
        onLeadChange={tab === "employees" ? setLeadId : undefined}
      >
        {tab === "employees" && (
          <Input
            label="Search"
            leftIcon={Search}
            placeholder="Name, ID or department"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        )}
      </FilterBar>

      {error ? (
        <ErrorState
          title="Couldn't load this report"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching the report."
          }
          onRetry={load}
        />
      ) : loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : tab === "employees" ? (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">
                {selectedLead
                  ? `${fullName(selectedLead.first_name, selectedLead.last_name)}'s team`
                  : "Everyone"}
              </h2>
              <p className="text-xs text-muted">
                {employees.length}{" "}
                {employees.length === 1 ? "person" : "people"} ·{" "}
                {monthLabel(month)}
              </p>
            </div>
            <BreakdownTotals rows={employees} />
          </div>
          <BreakdownTable
            rows={employees}
            showRole
            onSelect={(row) =>
              navigate(`/admin/reports/employee/${row.id}?month=${month}`)
            }
            emptyIcon={Users}
            emptyTitle="No people match these filters"
            emptyDescription="Try another month, project or lead."
          />
        </Card>
      ) : tab === "leads" ? (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Lead-wise</h2>
            <p className="text-xs text-muted">
              Totals across each lead's team · {monthLabel(month)}
            </p>
          </div>
          {(data?.leads ?? []).length === 0 ? (
            <EmptyState
              icon={Users2}
              title="No leads yet"
              description="Create a lead and assign employees to see team totals."
            />
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <Tr>
                  <Th>Lead</Th>
                  <Th className="text-center">Team size</Th>
                  {dayStatusOrder.map((key) => (
                    <Th key={key} className="text-center">
                      {dayStatus[key].label}
                    </Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {data.leads.map((lead) => (
                  <Tr
                    key={lead.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setLeadId(String(lead.id));
                      setTab("employees");
                    }}
                  >
                    <Td>
                      <p className="text-sm font-medium text-ink">
                        {fullName(lead.first_name, lead.last_name)}
                      </p>
                      <p className="text-xs text-muted">
                        {lead.employee_id}
                        {lead.department ? ` · ${lead.department}` : ""}
                      </p>
                    </Td>
                    <Td className="text-center">
                      <Badge tone={lead.team_size ? "primary" : "muted"}>
                        {lead.team_size}
                      </Badge>
                    </Td>
                    {dayStatusOrder.map((key) => (
                      <Td key={key} className="text-center">
                        <Count value={lead[key]} tone={dayStatus[key].dot} />
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b border-line px-5 py-4">
            <h2 className="text-sm font-semibold text-ink">Project-wise</h2>
            <p className="text-xs text-muted">
              Days booked against each project · {monthLabel(month)}
            </p>
          </div>
          {(data?.projects ?? []).length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title="No projects yet"
              description="Create a project and assign leads to it to see project reporting."
            />
          ) : (
            <Table className="rounded-none border-0">
              <THead>
                <Tr>
                  <Th>Project</Th>
                  <Th className="text-center">Leads</Th>
                  {dayStatusOrder.map((key) => (
                    <Th key={key} className="text-center">
                      {dayStatus[key].label}
                    </Th>
                  ))}
                </Tr>
              </THead>
              <TBody>
                {data.projects.map((project) => (
                  <Tr
                    key={project.id}
                    className="cursor-pointer"
                    onClick={() => {
                      setProjectId(String(project.id));
                      setTab("employees");
                    }}
                  >
                    <Td>
                      <p className="text-sm font-medium text-ink">
                        {project.name}
                      </p>
                      <p className="text-xs text-muted">
                        {project.status === "active" ? "Active" : "Archived"}
                      </p>
                    </Td>
                    <Td className="text-center">
                      <Badge tone={project.lead_count ? "info" : "muted"}>
                        {project.lead_count}
                      </Badge>
                    </Td>
                    {dayStatusOrder.map((key) => (
                      <Td key={key} className="text-center">
                        <Count value={project[key]} tone={dayStatus[key].dot} />
                      </Td>
                    ))}
                  </Tr>
                ))}
              </TBody>
            </Table>
          )}
        </Card>
      )}

      {!loading && !error && tab === "employees" && employees.length > 0 && (
        <p className="flex items-center gap-1.5 px-1 text-xs text-faint">
          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
          Select any person to see their day-by-day and weekly breakdown.
        </p>
      )}
    </div>
  );
}

export default Reports;
