import { useState } from "react";
import { formatDateDay } from "../../lib/format";
import { dayStatus, dayStatusOrder } from "../../lib/status";
import { cn } from "../../lib/utils";

/**
 * A month at one column per working day, from `buildDailySeries`.
 *
 * Each column stacks that day's status mix in the shared dayStatus colours.
 * For one person a day is a single full-height block — a status strip; for a
 * team or the organisation the stack shows how the day was split.
 *
 * Hovering a column writes its detail into the readout above the bars rather
 * than into a floating tooltip: a month is 20-odd narrow targets, and a
 * tooltip over the first or last of them would be clipped by the card.
 */

/** Colour key for the stacked columns, in the shared breakdown order. */
export function DailyTrendLegend({ className }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {dayStatusOrder.map((key) => (
        <li key={key} className="flex items-center gap-1.5 text-xs text-muted">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ backgroundColor: dayStatus[key].dot }}
            aria-hidden="true"
          />
          {dayStatus[key].label}
        </li>
      ))}
    </ul>
  );
}

export function DailyTrend({
  days = [],
  max,
  summary = null,
  height = 150,
  className,
}) {
  const [hovered, setHovered] = useState(null);

  const totalOf = (day) =>
    day.segments.reduce((sum, segment) => sum + segment.value, 0);

  const ceiling = max ?? Math.max(1, ...days.map((day) => totalOf(day)));

  const axisHeight = 16;
  const barArea = height - axisHeight - 6;
  const active = hovered === null ? null : days[hovered];

  const describe = (day) =>
    day.segments.length === 0
      ? "Nothing recorded"
      : day.segments
          .map((segment) => `${segment.value} ${segment.label.toLowerCase()}`)
          .join(" · ");

  return (
    <div className={className}>
      <p className="flex h-5 items-center gap-2 text-xs">
        {active ? (
          <>
            <span className="font-semibold text-ink">
              {formatDateDay(active.iso)}
            </span>
            <span className="text-muted">{describe(active)}</span>
          </>
        ) : (
          <span className="text-muted">{summary ?? "Hover a day for detail"}</span>
        )}
      </p>

      <div
        className="mt-2 flex items-end gap-px sm:gap-0.5"
        style={{ height }}
        role="img"
        aria-label="How each day was spent"
        onMouseLeave={() => setHovered(null)}
      >
        {days.map((day, index) => {
          const total = totalOf(day);
          const barHeight =
            total > 0 ? Math.max(3, Math.round((total / ceiling) * barArea)) : 2;
          const showLabel =
            day.today || day.dayNum === 1 || day.dayNum % 5 === 0;

          return (
            <div
              key={day.iso}
              className={cn(
                "group flex h-full min-w-0 flex-1 flex-col justify-end rounded-sm",
                // Weekends are tinted behind the whole column, axis label
                // included: a band that runs past the baseline reads as
                // background, where one stopping at the baseline would read as
                // a full-height bar.
                day.weekend && "bg-slate-50",
                hovered === index && "bg-slate-100",
              )}
              onMouseEnter={() => setHovered(index)}
              aria-label={`${day.iso}: ${describe(day)}`}
              role="img"
            >
              <div
                className="relative flex w-full items-end justify-center"
                style={{ height: barArea }}
              >
                {total > 0 ? (
                  <div
                    className="flex w-full flex-col-reverse overflow-hidden rounded-t-[3px]"
                    style={{ height: barHeight }}
                  >
                    {day.segments.map((segment) => (
                      <div
                        key={segment.key}
                        style={{
                          height: `${(segment.value / total) * 100}%`,
                          backgroundColor: segment.color,
                        }}
                      />
                    ))}
                  </div>
                ) : (
                  <div
                    className="w-full rounded-t-[3px] bg-line"
                    style={{ height: barHeight }}
                  />
                )}
              </div>

              <span
                className={cn(
                  "mt-1.5 h-4 text-center text-[9px] leading-4 tabular",
                  day.today
                    ? "font-semibold text-primary"
                    : "font-medium text-faint",
                )}
              >
                {showLabel ? day.dayNum : ""}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
