-- Trackify schema
-- Idempotent: safe to run repeatedly (CREATE ... IF NOT EXISTS). Applied on
-- startup by src/database/setup.js and runnable manually via:
--   node -e "require('./src/database/setup')()"

-- ---------------------------------------------------------------------------
-- Projects — client projects or internal initiatives
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS projects (
    id             SERIAL PRIMARY KEY,
    name           VARCHAR(150) NOT NULL UNIQUE,
    description    TEXT,
    status         VARCHAR(20) DEFAULT 'active',
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Departments — project-scoped departments
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS departments (
    id             SERIAL PRIMARY KEY,
    project_id     INT NOT NULL,
    name           VARCHAR(100) NOT NULL,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_dept_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT uq_dept_project_name UNIQUE (project_id, name)
);

-- ---------------------------------------------------------------------------
-- Users — every account (employees + admins + leads) lives in one table.
-- Employees start as `pending` (no password) until they activate their
-- account. Admins are seeded `active` by the bootstrap.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id             SERIAL PRIMARY KEY,
    employee_id    VARCHAR(20) UNIQUE NOT NULL,
    first_name     VARCHAR(100) NOT NULL,
    last_name      VARCHAR(100) NOT NULL,
    email          VARCHAR(150) UNIQUE NOT NULL,
    phone          VARCHAR(20),
    department     VARCHAR(100),
    designation    VARCHAR(100),
    joining_date   DATE,
    password       TEXT,
    role           VARCHAR(20) NOT NULL DEFAULT 'employee' CHECK (role IN ('admin', 'lead', 'employee')),
    lead_id        INT,
    account_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    token_version  INT NOT NULL DEFAULT 0,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_lead
        FOREIGN KEY (lead_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Project Leads — many-to-many: projects <-> leads + department assignment
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS project_leads (
    id             SERIAL PRIMARY KEY,
    project_id     INT NOT NULL,
    lead_id        INT NOT NULL,
    department_id  INT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_pl_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pl_lead
        FOREIGN KEY (lead_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_pl_dept
        FOREIGN KEY (department_id)
        REFERENCES departments(id)
        ON DELETE SET NULL,
    CONSTRAINT uq_pl_project_lead UNIQUE (project_id, lead_id)
);

-- ---------------------------------------------------------------------------
-- Leave requests — full workflow with approval chain
-- Status: pending, approved, rejected, cancelled
-- Request type: vacation, sick, flyback, wfh, other — every exception to the
-- default working day is raised and approved through this one table.
-- CREATED BEFORE ATTENDANCE (for foreign key reference)
-- ---------------------------------------------------------------------------
-- `approver_id` is the routing target captured when the request is raised:
-- an employee's request routes to their lead; a lead's (or admin's) request has
-- no lead above them, so `approver_id` stays NULL and it lands in the admin
-- queue. Storing it (rather than re-deriving from users.lead_id) keeps a
-- request in the queue it was filed into even if the reporting line changes.
CREATE TABLE IF NOT EXISTS leave_requests (
    id             SERIAL PRIMARY KEY,
    user_id        INT NOT NULL,
    project_id     INT,
    leave_type     VARCHAR(20) NOT NULL DEFAULT 'vacation' CHECK (leave_type IN ('vacation', 'sick', 'flyback', 'wfh', 'other')),
    start_date     DATE NOT NULL,
    end_date       DATE NOT NULL,
    reason         TEXT NOT NULL,
    status         VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled')),
    approver_id    INT,
    approved_by    INT,
    approval_notes TEXT,
    rejection_reason TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_leave_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_leave_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_leave_routed_to
        FOREIGN KEY (approver_id)
        REFERENCES users(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_leave_approver
        FOREIGN KEY (approved_by)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- Added after the table shipped; kept here so existing databases pick it up.
-- Rows written before the column existed are routed retroactively from the
-- requester's current lead (NULL lead => admin queue, which is already the
-- column default, so only employees-with-a-lead need backfilling).
ALTER TABLE leave_requests ADD COLUMN IF NOT EXISTS approver_id INT
    REFERENCES users(id) ON DELETE SET NULL;

UPDATE leave_requests lr
SET approver_id = u.lead_id
FROM users u
WHERE lr.user_id = u.id
  AND lr.approver_id IS NULL
  AND u.lead_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Attendance — exactly one row per user per calendar day.
--
-- `project_id` records which project the day was booked against, but it is an
-- attribute of the day rather than part of its identity. Keying on
-- (user_id, work_date) is what makes the monthly/weekly reports exact: "days
-- worked from office in March" must count days, and a per-project key would
-- count the same day once per project an employee touches.
--
-- A row records an *exception* to the default working day. Every employee is
-- taken to be working from the office unless an approved request says
-- otherwise, so the absence of a row is itself the answer and no row is
-- written for an ordinary office day.
--
-- Status: wfo, wfh, flyback, on_leave
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id             SERIAL PRIMARY KEY,
    user_id        INT NOT NULL,
    project_id     INT,
    work_date      DATE NOT NULL,
    status         VARCHAR(20) NOT NULL DEFAULT 'wfo' CHECK (status IN ('wfo', 'wfh', 'flyback', 'on_leave')),
    leave_request_id INT,
    notes          TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE CASCADE,
    CONSTRAINT fk_project
        FOREIGN KEY (project_id)
        REFERENCES projects(id)
        ON DELETE SET NULL,
    CONSTRAINT fk_leave_req
        FOREIGN KEY (leave_request_id)
        REFERENCES leave_requests(id)
        ON DELETE SET NULL,
    CONSTRAINT uq_attendance_user_day UNIQUE (user_id, work_date)
);

-- Databases created against the earlier (user_id, project_id, work_date) key
-- carry a constraint of the same name with the wrong columns. Postgres treats
-- NULL project_id values as distinct, so that key let a user accumulate several
-- rows for one day. Collapse any such duplicates (keeping the most recently
-- updated row) and re-key the table on (user_id, work_date).
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM pg_constraint c
        JOIN pg_class t ON t.oid = c.conrelid
        WHERE t.relname = 'attendance'
          AND c.conname = 'uq_attendance_user_day'
          AND array_length(c.conkey, 1) = 3
    ) THEN
        DELETE FROM attendance a
        USING attendance b
        WHERE a.user_id = b.user_id
          AND a.work_date = b.work_date
          AND (a.updated_at, a.id) < (b.updated_at, b.id);

        ALTER TABLE attendance DROP CONSTRAINT uq_attendance_user_day;
        ALTER TABLE attendance
            ADD CONSTRAINT uq_attendance_user_day UNIQUE (user_id, work_date);
    END IF;
END
$$;

-- Check-in / check-out was removed: a day is either the default (work from
-- office) or an exception raised through an approved request, so there is no
-- clock left to read and no way to be silently 'absent'.
--
-- The retired statuses all mean "an ordinary day at the office" under the new
-- rules, and an ordinary day is stored as the absence of a row — so these are
-- deleted rather than rewritten. Keeping them as 'wfo' rows would leave every
-- one of those days reading as an explicit exception that says nothing.
DELETE FROM attendance
 WHERE status IN ('present', 'absent', 'wfo')
   AND leave_request_id IS NULL;

ALTER TABLE attendance DROP COLUMN IF EXISTS check_in;
ALTER TABLE attendance DROP COLUMN IF EXISTS check_out;
ALTER TABLE attendance DROP COLUMN IF EXISTS total_hours;
ALTER TABLE attendance DROP COLUMN IF EXISTS check_in_status;

-- Re-key both CHECKs to the surviving vocabulary. Dropping by the name Postgres
-- gives an inline constraint keeps this idempotent on databases that already
-- have the new definition from the CREATE TABLE above.
ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_check;
ALTER TABLE attendance ADD CONSTRAINT attendance_status_check
    CHECK (status IN ('wfo', 'wfh', 'flyback', 'on_leave'));

ALTER TABLE leave_requests DROP CONSTRAINT IF EXISTS leave_requests_leave_type_check;
ALTER TABLE leave_requests ADD CONSTRAINT leave_requests_leave_type_check
    CHECK (leave_type IN ('vacation', 'sick', 'flyback', 'wfh', 'other'));

-- ---------------------------------------------------------------------------
-- Audit Logs — track all changes for compliance and debugging
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
    id             SERIAL PRIMARY KEY,
    user_id        INT,
    action         VARCHAR(50) NOT NULL,
    entity_type    VARCHAR(50) NOT NULL,
    entity_id      INT,
    changes        JSONB,
    ip_address     VARCHAR(45),
    user_agent     TEXT,
    created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_audit_user
        FOREIGN KEY (user_id)
        REFERENCES users(id)
        ON DELETE SET NULL
);

-- ---------------------------------------------------------------------------
-- Indexes for the query patterns actually used by the app.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_users_role          ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_lead          ON users(lead_id);
CREATE INDEX IF NOT EXISTS idx_attendance_user_day ON attendance(user_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_project  ON attendance(project_id, work_date DESC);
CREATE INDEX IF NOT EXISTS idx_attendance_workday  ON attendance(work_date);
CREATE INDEX IF NOT EXISTS idx_attendance_status   ON attendance(status);
CREATE INDEX IF NOT EXISTS idx_leave_user          ON leave_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_approver      ON leave_requests(approver_id, status);
-- The admin queue is "requests with nobody above the requester", i.e. NULL
-- approver_id — a plain b-tree on the column above does not serve that scan.
CREATE INDEX IF NOT EXISTS idx_leave_admin_queue   ON leave_requests(status)
    WHERE approver_id IS NULL;
CREATE INDEX IF NOT EXISTS idx_leave_project       ON leave_requests(project_id, status);
CREATE INDEX IF NOT EXISTS idx_leave_date          ON leave_requests(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_project_leads       ON project_leads(project_id, lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_logs(entity_type, entity_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user          ON audit_logs(user_id, created_at DESC);
