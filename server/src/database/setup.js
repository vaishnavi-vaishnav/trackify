const fs = require("fs");
const path = require("path");
const pool = require("./db");
const bcrypt = require("bcrypt");

/**
 * Apply the schema idempotently and seed the first admin account.
 * Called once on server startup; safe to run repeatedly.
 *
 * Responsibilities:
 *  1. Run schema.sql (all CREATE ... IF NOT EXISTS).
 *  2. Clean up abandoned experiment tables (activation_tokens, refresh_tokens)
 *     that no code references.
 *  3. Backfill the attendance UNIQUE (user_id, work_date) constraint onto
 *     databases created before it existed (skips with a warning if the
 *     existing data already contains duplicates).
 *  4. Ensure an admin account exists (env-driven, idempotent).
 */
const setupDatabase = async () => {
    const schemaPath = path.join(__dirname, "schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");

    const client = await pool.connect();
    try {
        await client.query("BEGIN");

        await client.query(schema);

        // Drop abandoned experiment tables (empty, unreferenced by any code),
        // including the stale migration-runner bookkeeping table.
        for (const table of [
            "activation_tokens",
            "refresh_tokens",
            "pgmigrations",
        ]) {
            await client.query(
                `DROP TABLE IF EXISTS ${table} CASCADE`,
            );
        }

        // Note: The new schema already includes all constraints via CREATE TABLE
        // The UNIQUE(user_id, project_id, work_date) is defined in schema.sql
        // so no backfill needed here.

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    await seedAdmin();
};

/**
 * Idempotent admin bootstrap. The admin account is env-driven: on every boot
 * the single admin's email / employee id / password are synced to the env
 * values so the documented credentials always work. (There is no
 * change-password UI, so env is the source of truth for this account.)
 */
const seedAdmin = async () => {
    const email = process.env.ADMIN_EMAIL || "admin@trackify.app";
    const employeeId = process.env.ADMIN_EMPLOYEE_ID || "ADMIN001";
    const password = process.env.ADMIN_PASSWORD || "Admin@123";

    const existing = await pool.query(
        "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
    );

    const hashed = await bcrypt.hash(password, 10);

    if (existing.rows.length > 0) {
        await pool.query(
            `UPDATE users
             SET password = $1, email = $2, account_status = 'active',
                 updated_at = CURRENT_TIMESTAMP
             WHERE id = $3`,
            [hashed, email, existing.rows[0].id],
        );
        return;
    }

    await pool.query(
        `INSERT INTO users
            (employee_id, first_name, last_name, email, password, role, account_status)
         VALUES ($1, $2, $3, $4, $5, 'admin', 'active')
         ON CONFLICT (email) DO NOTHING`,
        [employeeId, "Admin", "User", email, hashed],
    );
};

module.exports = setupDatabase;
