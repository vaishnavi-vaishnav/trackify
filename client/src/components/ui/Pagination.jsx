import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Build the page numbers to show: always the first and last, the current page
 * with a neighbour either side, and ellipses for the gaps. Keeps the control a
 * fixed width whether there are 3 pages or 3,000.
 */
function pageItems(page, totalPages) {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items = new Set([1, totalPages, page, page - 1, page + 1]);
  const pages = [...items]
    .filter((p) => p >= 1 && p <= totalPages)
    .sort((a, b) => a - b);

  const withGaps = [];
  pages.forEach((p, i) => {
    if (i > 0 && p - pages[i - 1] > 1) withGaps.push(`gap-${p}`);
    withGaps.push(p);
  });
  return withGaps;
}

/**
 * Page control for server-paged lists. Renders nothing for a single page, so
 * small datasets stay uncluttered.
 */
export function Pagination({ page, totalPages, total, pageSize, onChange, label = "items" }) {
  if (!totalPages || totalPages <= 1) {
    return total ? (
      <p className="px-1 text-xs text-muted" aria-live="polite">
        {total} {label}
      </p>
    ) : null;
  }

  const first = (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      className="flex flex-wrap items-center justify-between gap-3 px-1"
      aria-label="Pagination"
    >
      <p className="text-xs text-muted" aria-live="polite">
        Showing <span className="font-medium text-ink-soft">{first}–{last}</span>{" "}
        of <span className="font-medium text-ink-soft">{total}</span> {label}
      </p>

      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>

        {pageItems(page, totalPages).map((item) =>
          typeof item === "string" ? (
            <span key={item} className="px-1 text-xs text-faint" aria-hidden="true">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 rounded-lg px-2 text-xs font-medium tabular transition-colors",
                item === page
                  ? "bg-primary text-white shadow-sm"
                  : "border border-line bg-surface text-muted hover:border-primary hover:text-primary",
              )}
            >
              {item}
            </button>
          ),
        )}

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
          className="grid h-8 w-8 place-items-center rounded-lg border border-line bg-surface text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </nav>
  );
}
