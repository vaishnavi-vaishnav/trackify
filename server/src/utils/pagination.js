/**
 * Shared paging for list endpoints.
 *
 * Lists are paged rather than returned whole: a directory that is fine at 20
 * people is a slow query and a 2 MB response at 20,000. Pickers that genuinely
 * need every row (a "choose a lead" dropdown) opt out with `pageSize=all`,
 * which is still capped so a bug can never ask the database for everything.
 */

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MAX_UNPAGED = 500;

const toPositiveInt = (value, fallback) => {
    const n = Number.parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Read `page` / `pageSize` off a query string into a `{ limit, offset }` the
 * models can use directly.
 */
const parsePagination = (query = {}, { defaultPageSize = DEFAULT_PAGE_SIZE } = {}) => {
    if (String(query.pageSize).toLowerCase() === "all") {
        return { page: 1, pageSize: MAX_UNPAGED, limit: MAX_UNPAGED, offset: 0, unpaged: true };
    }

    const page = toPositiveInt(query.page, 1);
    const pageSize = Math.min(
        toPositiveInt(query.pageSize, defaultPageSize),
        MAX_PAGE_SIZE,
    );

    return {
        page,
        pageSize,
        limit: pageSize,
        offset: (page - 1) * pageSize,
        unpaged: false,
    };
};

/**
 * Build the `meta` block that travels beside `data`.
 *
 * `total` comes from a window function on the page query itself (one round
 * trip instead of a second COUNT), so it is the count *after* filtering.
 */
const buildMeta = ({ page, pageSize, total }) => ({
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

/**
 * Rows come back carrying `total_count` from the window function; strip it off
 * so it never leaks into the client's row shape.
 */
const splitCount = (rows, { page, pageSize }) => {
    const total = rows.length ? Number(rows[0].total_count) : 0;
    const data = rows.map(({ total_count, ...row }) => row);
    return { data, meta: buildMeta({ page, pageSize, total }) };
};

module.exports = {
    DEFAULT_PAGE_SIZE,
    MAX_PAGE_SIZE,
    parsePagination,
    buildMeta,
    splitCount,
};
