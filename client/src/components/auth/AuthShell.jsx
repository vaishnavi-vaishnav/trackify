import { Activity, BarChart3, CalendarCheck, ClockCheck } from "lucide-react";
import { Logo } from "../brand/Logo";

const FEATURES = [
  {
    icon: ClockCheck,
    title: "One-tap check-in",
    body: "Start and end your day in a click — hours total themselves.",
  },
  {
    icon: Activity,
    title: "Office, home, or flyback",
    body: "Mark how you worked and which project the day counts against.",
  },
  {
    icon: CalendarCheck,
    title: "Leave, decided in one place",
    body: "Raise a request and follow it through your lead's queue.",
  },
  {
    icon: BarChart3,
    title: "Reports at every level",
    body: "Your month, your lead's team, the whole organisation.",
  },
];

/**
 * Split-screen authentication layout: dark brand panel with product
 * highlights on the left, the form on a light canvas on the right.
 */
export function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
      <aside className="relative hidden overflow-hidden bg-sidebar lg:flex lg:flex-col">
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden="true"
        >
          <span className="absolute -left-24 top-24 h-72 w-72 rounded-full bg-secondary/25 blur-3xl animate-glow-drift" />
          <span className="absolute bottom-10 right-0 h-80 w-80 rounded-full bg-violet/20 blur-3xl animate-glow-drift [animation-delay:-3s]" />
        </div>
        <div className="relative flex flex-1 flex-col p-12">
          <Logo variant="light" />
          <div className="mt-auto">
            <h2 className="font-display text-3xl font-bold leading-tight text-white">
              Work hours, tracked
              <br />
              without the paperwork.
            </h2>
            <ul className="mt-10 space-y-5">
              {FEATURES.map((feature) => (
                <li
                  key={feature.title}
                  className="flex items-start gap-3.5"
                >
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white/5 ring-1 ring-white/10">
                    <feature.icon
                      className="h-4.5 w-4.5 text-secondary"
                      aria-hidden="true"
                    />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {feature.title}
                    </p>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-slate-400">
                      {feature.body}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <main className="flex items-center justify-center bg-canvas px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">
          <div className="mb-10 lg:hidden">
            <Logo variant="dark" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && (
            <p className="mt-1.5 text-sm text-muted">{subtitle}</p>
          )}
          {children}
          {footer && (
            <div className="mt-8 border-t border-line pt-6 text-center text-sm">
              {footer}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
