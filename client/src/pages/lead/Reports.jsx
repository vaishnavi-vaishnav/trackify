import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Search, Users2 } from "lucide-react";
import { Card } from "../../components/ui/Card";
import { ErrorState } from "../../components/ui/ErrorState";
import { Input } from "../../components/ui/Input";
import { Skeleton } from "../../components/ui/Skeleton";
import { FilterBar } from "../../components/reports/FilterBar";
import {
  BreakdownTable,
  BreakdownTotals,
} from "../../components/reports/BreakdownTable";
import { useAuth } from "../../context/AuthContext";
import { getEmployeeBreakdown } from "../../services/reports";
import { getLeadProjects } from "../../services/leads";
import { monthKey, monthLabel } from "../../lib/format";

/**
 * A lead's own team report. The API scopes the request to the caller's team,
 * so there is no lead selector here — this is always "my people".
 */
function Reports() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const [month, setMonth] = useState(params.get("month") ?? monthKey());
  const [projectId, setProjectId] = useState(params.get("projectId"));
  const [query, setQuery] = useState("");

  const [projects, setProjects] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const next = { month };
    if (projectId) next.projectId = projectId;
    setParams(next, { replace: true });
  }, [month, projectId, setParams]);

  useEffect(() => {
    if (!user?.id) return;
    getLeadProjects(user.id)
      .then(setProjects)
      .catch(() => {
        // Optional filter; the report below still loads without it.
      });
  }, [user?.id]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(
        await getEmployeeBreakdown({
          month,
          ...(projectId ? { projectId } : {}),
        }),
      );
    } catch (err) {
      setError(err);
    } finally {
      setLoading(false);
    }
  }, [month, projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = useMemo(() => {
    const list = data?.employees ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((row) =>
      [row.first_name, row.last_name, row.employee_id, row.department]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [data, query]);

  return (
    <div className="animate-fade-up space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight text-ink">
          Team reports
        </h1>
        <p className="mt-1.5 text-sm text-muted">
          How your people spent {monthLabel(month)}
        </p>
      </header>

      <FilterBar
        month={month}
        onMonthChange={setMonth}
        projects={projects}
        projectId={projectId}
        onProjectChange={setProjectId}
      >
        <Input
          label="Search"
          leftIcon={Search}
          placeholder="Name or ID"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </FilterBar>

      {error ? (
        <ErrorState
          title="Couldn't load your team report"
          description={
            error.response?.data?.message ||
            "Something went wrong while fetching the report."
          }
          onRetry={load}
        />
      ) : loading ? (
        <Skeleton className="h-96 rounded-xl" />
      ) : (
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-line px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-ink">My team</h2>
              <p className="text-xs text-muted">
                {rows.length} {rows.length === 1 ? "person" : "people"} ·{" "}
                {monthLabel(month)}
              </p>
            </div>
            <BreakdownTotals rows={rows} />
          </div>
          <BreakdownTable
            rows={rows}
            showLead={false}
            onSelect={(row) =>
              navigate(`/lead/reports/employee/${row.id}?month=${month}`)
            }
            emptyIcon={Users2}
            emptyTitle="Nobody reports to you yet"
            emptyDescription="Once an admin assigns employees to you, their attendance appears here."
          />
        </Card>
      )}
    </div>
  );
}

export default Reports;
