import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "../../lib/utils";

/**
 * The title block every page opens with: heading, one line of context, an
 * optional back link, and the page's primary actions on the right.
 *
 * Having one component means the heading level, spacing and action placement
 * stay identical across a growing set of screens instead of drifting page by
 * page.
 */
export function PageHeader({
  title,
  description,
  actions,
  backTo,
  backLabel = "Back",
  className,
}) {
  const navigate = useNavigate();

  return (
    <header className={cn("space-y-3", className)}>
      {backTo && (
        <button
          type="button"
          onClick={() => navigate(backTo)}
          className="-ml-1 inline-flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-[13px] font-medium text-muted transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {backLabel}
        </button>
      )}

      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight text-ink">{title}</h1>
          {description && (
            <p className="mt-1.5 text-sm text-muted">{description}</p>
          )}
        </div>
        {actions && (
          <div className="flex flex-wrap items-center gap-2.5">{actions}</div>
        )}
      </div>
    </header>
  );
}

/**
 * The filter row that sits under a page header: a search box on the left and
 * whatever chips or selects the page needs on the right.
 */
export function Toolbar({ search, children, className }) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-xl border border-line bg-surface p-3 shadow-card sm:p-3.5 xl:flex-row xl:items-center xl:justify-between",
        className,
      )}
    >
      {search && <div className="w-full xl:max-w-xs">{search}</div>}
      {children && (
        <div className="flex flex-wrap items-center gap-2.5">{children}</div>
      )}
    </div>
  );
}
