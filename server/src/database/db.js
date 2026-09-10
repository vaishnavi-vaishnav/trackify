const { Pool, types } = require("pg");
require("dotenv").config({ quiet: true });

/**
 * Hand back DATE columns exactly as Postgres stored them: "YYYY-MM-DD".
 *
 * By default the driver turns a DATE into a JS Date at *local* midnight, which
 * then serialises to JSON as a UTC instant — so 2024-01-15 leaves an IST server
 * as "2024-01-14T18:30:00.000Z", and any client reading the first ten
 * characters gets the wrong day. These columns (work_date, start_date,
 * joining_date …) are calendar days, not instants, so the string is both the
 * honest representation and the one every consumer already wants.
 *
 * 1082 is the DATE type OID.
 */
types.setTypeParser(1082, (value) => value);

const pool = new Pool(
    process.env.DATABASE_URL
        ? {
              connectionString: process.env.DATABASE_URL,
              ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : false,
          }
        : {
              host: process.env.DB_HOST || "localhost",
              port: Number(process.env.DB_PORT) || 5432,
              user: process.env.DB_USER,
              password: process.env.DB_PASSWORD,
              database: process.env.DB_NAME,
          },
);

module.exports = pool;
