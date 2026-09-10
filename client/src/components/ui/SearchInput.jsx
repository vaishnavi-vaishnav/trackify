import { Search, X } from "lucide-react";
import { cn } from "../../lib/utils";

/**
 * Toolbar search box with a clear button.
 *
 * Deliberately uncontrolled about *when* it queries: the page holds the typed
 * value and debounces it before hitting the server, so typing stays instant
 * while requests stay sparse.
 */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  label = "Search",
  className,
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-faint"
        aria-hidden="true"
      />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9.5 w-full rounded-lg border border-line bg-surface pl-10 pr-9 text-sm text-ink shadow-sm",
          "placeholder:text-faint transition-colors duration-150",
          "focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15",
          // Safari renders its own clear affordance on type=search; ours is the
          // one that matches the design system.
          "[&::-webkit-search-cancel-button]:appearance-none",
        )}
      />
      {value && (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => onChange("")}
          className="absolute right-2.5 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-faint transition-colors hover:bg-slate-100 hover:text-ink"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
