import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "../../lib/utils";
import { useLockBodyScroll } from "../../hooks/useLockBodyScroll";
import { IconButton } from "./IconButton";

const sizes = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal dialog: focus trap, Escape to close, focus restore,
 * body-scroll lock, and scale-in entrance.
 *
 * Rendered through a portal onto `document.body` rather than in place. A
 * `position: fixed` element is positioned against the nearest ancestor that
 * has a transform/filter/perspective rather than against the viewport, and the
 * page-entrance animation leaves a `translateY(0)` on its container
 * permanently (`animation-fill-mode: both`) — so an in-place modal would be
 * trapped inside the scrolled page body and hang off the bottom of the screen.
 * The portal puts it outside every such ancestor, whatever pages do later.
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = "md",
  className,
}) {
  const panelRef = useRef(null);
  const titleId = useId();
  useLockBodyScroll(open);

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const previous = document.activeElement;

    const focusable = () =>
      Array.from(panel.querySelectorAll(FOCUSABLE)).filter((el) => !el.disabled);

    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    // Initial focus
    requestAnimationFrame(() => {
      const first = focusable()[0];
      (first ?? panel).focus();
    });

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previous?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-t-2xl border border-line bg-surface shadow-lift sm:rounded-2xl animate-scale-in",
          sizes[size],
          className,
        )}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-line px-6 py-4">
          <div className="min-w-0">
            <h3 id={titleId} className="text-base font-semibold text-ink">
              {title}
            </h3>
            {description && (
              <p className="mt-0.5 text-[13px] text-muted">{description}</p>
            )}
          </div>
          <IconButton label="Close dialog" icon={X} onClick={onClose} size="sm" />
        </div>

        {/* Only the body scrolls, so the header and footer actions stay put
            however tall the content grows. */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-line bg-slate-50/50 px-6 py-4 sm:flex-row sm:justify-end">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
