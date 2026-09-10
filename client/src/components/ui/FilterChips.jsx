import { cn } from "../../lib/utils";

/**
 * Segmented filter with optional counts.
 *
 * The counts describe the whole dataset, not the current page — a chip reading
 * "Leads 4" should keep saying 4 while you are looking at the employees tab,
 * so a viewer can tell what else is there without clicking.
 */
export function FilterChips({ label, options, value, onChange, className }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn(
        "inline-flex w-fit max-w-full flex-wrap rounded-lg border border-line bg-surface p-0.5 shadow-sm",
        className,
      )}
    >
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value ?? "all"}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-xs font-medium transition-colors",
              active
                ? "bg-primary text-white shadow-sm"
                : "text-muted hover:text-ink",
            )}
          >
            {option.label}
            {option.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-px text-[10px] tabular",
                  active ? "bg-white/20 text-white" : "bg-slate-100 text-muted",
                )}
              >
                {option.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
