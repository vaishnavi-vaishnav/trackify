import { toISODate } from "./format";
import { dayStatus, dayStatusOrder } from "./status";

/**
 * Shapes report rows into the series the charts read.
 *
 * The daily report only returns dates that have records. Charting those rows
 * directly would draw a month with the empty days squeezed out, so the gaps
 * are filled here instead — one entry per calendar day in the range, in order.
 */

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function buildDailySeries(rows = [], range = {}, { today } = {}) {
  const { startDate, endDate } = range;
  if (!startDate || !endDate) return [];

  const todayISO = today ?? toISODate();
  const byDate = new Map(
    rows.map((row) => [String(row.work_date).slice(0, 10), row]),
  );

  // Built from local parts: `new Date("2026-03-01")` would parse as UTC
  // midnight and shift the day west of Greenwich.
  const [year, month, first] = startDate.split("-").map(Number);
  const days = [];

  // A month is 31 days at most; the bound keeps a malformed range finite.
  for (let i = 0; i < 62; i += 1) {
    const date = new Date(year, month - 1, first + i);
    const iso = toISODate(date);
    if (iso > endDate) break;

    const row = byDate.get(iso);
    const weekday = date.getDay();

    days.push({
      iso,
      dayNum: date.getDate(),
      weekday: WEEKDAYS[weekday],
      weekend: weekday === 0 || weekday === 6,
      today: iso === todayISO,
      future: iso > todayISO,
      recorded: Number(row?.days_recorded ?? 0),
      // Only the statuses actually present, so a stacked column has no
      // zero-height slivers to render.
      segments: dayStatusOrder
        .map((key) => ({
          key,
          label: dayStatus[key].label,
          color: dayStatus[key].dot,
          value: Number(row?.[key] ?? 0),
        }))
        .filter((segment) => segment.value > 0),
    });
  }

  return days;
}
