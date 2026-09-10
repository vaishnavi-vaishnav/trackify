/**
 * Date / time / number formatting helpers for the UI.
 * All formatters are defensive: invalid or empty input returns "--".
 */

const timeFmt = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
});

const dateLongFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

const dateShortFmt = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
});

const dateDayFmt = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});

const dateFullFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "numeric",
});

const monthFmt = new Intl.DateTimeFormat("en-US", {
  month: "long",
  year: "numeric",
});

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Parse a value into a Date for display.
 *
 * A bare "YYYY-MM-DD" is a calendar day, not an instant, so it is built from
 * local parts: `new Date("2026-03-01")` would read it as UTC midnight, which
 * renders as the last day of February anywhere west of Greenwich.
 */
function toDate(value) {
  if (value === null || value === undefined || value === "") return null;

  if (typeof value === "string" && ISO_DATE_RE.test(value)) {
    const [y, m, d] = value.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "9:02 AM" — used for check-in / check-out columns. */
export function formatTime(value) {
  const d = toDate(value);
  return d ? timeFmt.format(d) : "--";
}

/** "Tuesday, August 5, 2026" — topbar / page headers. */
export function formatDateLong(value = new Date()) {
  const d = toDate(value) ?? new Date();
  return dateLongFmt.format(d);
}

/** "Aug 5" — compact labels. */
export function formatDateShort(value) {
  const d = toDate(value);
  return d ? dateShortFmt.format(d) : "--";
}

/** "Tue, Aug 5" — recent activity rows. */
export function formatDateDay(value) {
  const d = toDate(value);
  return d ? dateDayFmt.format(d) : "--";
}

/** "Aug 5, 2026" — table cells. */
export function formatDateFull(value) {
  const d = toDate(value);
  return d ? dateFullFmt.format(d) : "--";
}

/** "7.5 hrs" or "--" for zero / missing. */
export function formatHours(value) {
  if (value === null || value === undefined || value === "") return "--";
  const n = Number(value);
  if (Number.isNaN(n) || n === 0) return "--";
  return `${Number.isInteger(n) ? n : n.toFixed(1)} hrs`;
}

/** "7.5" — plain numeric hours for charts / comparisons. */
export function toHours(value) {
  const n = Number(value);
  return Number.isNaN(n) ? 0 : n;
}

/** "2026-08" — stable month key used for filtering / grouping. */
export function monthKey(value) {
  const d = toDate(value) ?? new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}`;
}

/** "August 2026" — from a "YYYY-MM" key or a date. */
export function monthLabel(input) {
  if (typeof input === "string" && /^\d{4}-\d{2}$/.test(input)) {
    const [y, m] = input.split("-").map(Number);
    const d = new Date(y, m - 1, 1);
    return monthFmt.format(d);
  }
  const d = toDate(input) ?? new Date();
  return monthFmt.format(d);
}

/**
 * The last `count` months as { value: "2026-09", label: "September 2026" },
 * newest first — the options behind every month picker.
 */
export function recentMonths(count = 12) {
  const now = new Date();
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = monthKey(d);
    return { value, label: monthLabel(value) };
  });
}

/**
 * "YYYY-MM-DD" in local time. Dates here are calendar days, so they are built
 * from local parts — formatting via toISOString() would shift the day for
 * anyone west of Greenwich.
 */
export function toISODate(value = new Date()) {
  const d = toDate(value) ?? new Date();
  const m = `${d.getMonth() + 1}`.padStart(2, "0");
  const day = `${d.getDate()}`.padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

/** "Aug 5 – Aug 9, 2026" for a date range. */
export function formatRange(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return "--";
  if (s.getTime() === e.getTime()) return dateFullFmt.format(s);
  return `${dateShortFmt.format(s)} – ${dateFullFmt.format(e)}`;
}

/** Inclusive whole-day count between two dates. */
export function dayCount(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e) return 0;
  return Math.round((e - s) / 86400000) + 1;
}

/**
 * Weekdays in an inclusive range — the number that actually gets deducted.
 *
 * Approving leave skips weekends when it writes attendance, so a Friday-to-
 * Monday request costs two days, not four. Showing this while the dates are
 * being picked stops the form and the outcome disagreeing.
 */
export function workingDayCount(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e || e < s) return 0;

  let count = 0;
  const cursor = new Date(s);
  // Guarded so a mistyped year cannot spin: the API rejects ranges over a year.
  for (let i = 0; i <= 750 && cursor <= e; i += 1) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

/** Time-aware greeting. */
export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

/** True when the given ISO date falls on today (local). */
export function isToday(value) {
  const d = toDate(value);
  if (!d) return false;
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}

/** Nice first+last display, falling back gracefully. */
export function fullName(first, last, fallback = "Employee") {
  const parts = [first, last].filter(Boolean).map(String);
  return parts.length ? parts.join(" ") : fallback;
}
