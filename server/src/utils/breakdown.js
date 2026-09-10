/**
 * Postgres returns COUNT() as bigint and SUM() as numeric, and the driver hands
 * both back as strings so large values cannot lose precision. These counts are
 * small day tallies that the UI adds up and charts, where a string would
 * concatenate instead of sum — so every breakdown row is normalised here, in
 * one place, before it leaves the service layer.
 */

const BREAKDOWN_KEYS = [
    "days_recorded",
    "wfo",
    "wfh",
    "on_leave",
    "flyback",
    "team_size",
    "lead_count",
    "headcount",
];

/** Coerce the known count columns on one row; other fields pass through. */
const toNumericRow = (row, keys = BREAKDOWN_KEYS) => {
    if (!row) return row;
    const out = { ...row };
    for (const key of keys) {
        if (out[key] !== undefined && out[key] !== null) {
            out[key] = Number(out[key]);
        }
    }
    return out;
};

const toNumericRows = (rows, keys = BREAKDOWN_KEYS) =>
    (rows ?? []).map((row) => toNumericRow(row, keys));

module.exports = { BREAKDOWN_KEYS, toNumericRow, toNumericRows };
