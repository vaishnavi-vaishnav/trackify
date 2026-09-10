/**
 * Date helpers for the reporting and leave flows.
 *
 * Dates here are calendar days, not instants: they are passed to Postgres
 * `DATE` columns and shown to people as "the 3rd of March". Everything is
 * therefore handled as `YYYY-MM-DD` strings and built with the local-time
 * `Date(y, m, d)` constructor — parsing "2026-03-01" as a Date instead would
 * read it as UTC midnight and shift the day backwards west of Greenwich.
 */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_MONTH_RE = /^\d{4}-\d{2}$/;

const isValidISODate = (value) => {
    if (typeof value !== "string" || !ISO_DATE_RE.test(value)) return false;
    const [y, m, d] = value.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return (
        date.getFullYear() === y &&
        date.getMonth() === m - 1 &&
        date.getDate() === d
    );
};

const isValidISOMonth = (value) =>
    typeof value === "string" &&
    ISO_MONTH_RE.test(value) &&
    Number(value.slice(5, 7)) >= 1 &&
    Number(value.slice(5, 7)) <= 12;

/** A Date (or `YYYY-MM-DD`) as a local-time `YYYY-MM-DD` string. */
const toISODate = (value) => {
    if (typeof value === "string" && ISO_DATE_RE.test(value)) return value;
    const date = value instanceof Date ? value : new Date(value);
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${d}`;
};

const todayISO = () => toISODate(new Date());

/** The current month as `YYYY-MM`. */
const currentMonth = () => todayISO().slice(0, 7);

/**
 * First and last day of a `YYYY-MM` month, defaulting to the current one.
 * Day 0 of the following month is the last day of this one, which handles
 * both month lengths and leap years without a table.
 */
const monthRange = (month) => {
    const key = isValidISOMonth(month) ? month : currentMonth();
    const [year, monthNum] = key.split("-").map(Number);
    const lastDay = new Date(year, monthNum, 0).getDate();

    return {
        month: key,
        startDate: `${key}-01`,
        endDate: `${key}-${String(lastDay).padStart(2, "0")}`,
    };
};

/** The Monday..Sunday week containing `date`. */
const weekRange = (date = todayISO()) => {
    const [y, m, d] = date.split("-").map(Number);
    const anchor = new Date(y, m - 1, d);
    // getDay() is 0 for Sunday; shift so Monday starts the week.
    const offset = (anchor.getDay() + 6) % 7;

    const start = new Date(y, m - 1, d - offset);
    const end = new Date(y, m - 1, d - offset + 6);

    return { startDate: toISODate(start), endDate: toISODate(end) };
};

/**
 * Every weekday from `start` to `end` inclusive.
 *
 * Weekends are dropped so a leave that spans a weekend does not inflate the
 * "days on leave" count with days nobody was due to work.
 */
const eachWorkingDay = (start, end) => {
    const [sy, sm, sd] = toISODate(start).split("-").map(Number);
    const cursor = new Date(sy, sm - 1, sd);
    const stop = toISODate(end);
    const days = [];

    // Bounded so a malformed range can never spin forever; a leave request
    // longer than two years is not a case worth expanding day by day.
    for (let guard = 0; guard < 750; guard += 1) {
        const iso = toISODate(cursor);
        if (iso > stop) break;
        const day = cursor.getDay();
        if (day !== 0 && day !== 6) days.push(iso);
        cursor.setDate(cursor.getDate() + 1);
    }

    return days;
};

/** Inclusive count of calendar days in a range. */
const daysBetween = (start, end) => {
    const [sy, sm, sd] = toISODate(start).split("-").map(Number);
    const [ey, em, ed] = toISODate(end).split("-").map(Number);
    const ms = new Date(ey, em - 1, ed) - new Date(sy, sm - 1, sd);
    return Math.round(ms / 86400000) + 1;
};

module.exports = {
    isValidISODate,
    isValidISOMonth,
    toISODate,
    todayISO,
    currentMonth,
    monthRange,
    weekRange,
    eachWorkingDay,
    daysBetween,
};
