require("dotenv").config({ quiet: true });

const bcrypt = require("bcrypt");
const pool = require("./db");
const setupDatabase = require("./setup");
const { eachWorkingDay, toISODate, todayISO } = require("../utils/dates");

/**
 * Populate a demo organisation so every screen has something real to show.
 *
 * Shape: two projects (CWC, SAIL), each with two leads, each lead with their
 * own employees, plus ~6 weeks of attendance and a few leave requests in every
 * state. Run with `npm run db:seed:demo`.
 *
 * Idempotent by construction: it deletes the accounts and projects it owns
 * (recognised by the DEMO_ prefix and the fixed project names) before
 * inserting, so re-running it refreshes the demo rather than duplicating it.
 */

const PASSWORD = "Password@123";

const PROJECTS = [
    { name: "CWC", description: "Client CWC delivery programme" },
    { name: "SAIL", description: "SAIL modernisation programme" },
];

const PEOPLE = [
    // Leads
    { id: "DEMO_L01", first: "Priya", last: "Nair", role: "lead", dept: "Engineering", title: "Delivery Lead", project: "CWC" },
    { id: "DEMO_L02", first: "Arjun", last: "Mehta", role: "lead", dept: "Engineering", title: "Tech Lead", project: "CWC" },
    { id: "DEMO_L03", first: "Sneha", last: "Iyer", role: "lead", dept: "Analytics", title: "Delivery Lead", project: "SAIL" },
    { id: "DEMO_L04", first: "Rahul", last: "Verma", role: "lead", dept: "Platform", title: "Tech Lead", project: "SAIL" },

    // Priya's team (CWC)
    { id: "DEMO_E01", first: "Ananya", last: "Rao", role: "employee", dept: "Engineering", title: "Senior Developer", lead: "DEMO_L01" },
    { id: "DEMO_E02", first: "Vikram", last: "Singh", role: "employee", dept: "Engineering", title: "Developer", lead: "DEMO_L01" },
    { id: "DEMO_E03", first: "Meera", last: "Joshi", role: "employee", dept: "Engineering", title: "QA Engineer", lead: "DEMO_L01" },

    // Arjun's team (CWC)
    { id: "DEMO_E04", first: "Karthik", last: "Menon", role: "employee", dept: "Engineering", title: "Developer", lead: "DEMO_L02" },
    { id: "DEMO_E05", first: "Divya", last: "Kulkarni", role: "employee", dept: "Engineering", title: "Senior Developer", lead: "DEMO_L02" },

    // Sneha's team (SAIL)
    { id: "DEMO_E06", first: "Rohan", last: "Desai", role: "employee", dept: "Analytics", title: "Data Analyst", lead: "DEMO_L03" },
    { id: "DEMO_E07", first: "Ishita", last: "Bose", role: "employee", dept: "Analytics", title: "Data Engineer", lead: "DEMO_L03" },
    { id: "DEMO_E08", first: "Naveen", last: "Pillai", role: "employee", dept: "Analytics", title: "Analyst", lead: "DEMO_L03" },

    // Rahul's team (SAIL)
    { id: "DEMO_E09", first: "Tanvi", last: "Shah", role: "employee", dept: "Platform", title: "SRE", lead: "DEMO_L04" },
    { id: "DEMO_E10", first: "Aditya", last: "Gupta", role: "employee", dept: "Platform", title: "DevOps Engineer", lead: "DEMO_L04" },
];

/**
 * A deterministic pseudo-random generator: the demo looks varied but is the
 * same on every run, so a screenshot or a bug report stays reproducible.
 */
const makeRandom = (seed) => {
    let state = seed;
    return () => {
        state = (state * 1664525 + 1013904223) % 4294967296;
        return state / 4294967296;
    };
};

/**
 * Weighted pick of a day's *exception*.
 *
 * Most days come back null, which is the point: an ordinary office day leaves
 * no row behind, so seeding one would misrepresent the model.
 */
const pickException = (rand) => {
    const roll = rand();
    if (roll < 0.18) return "wfh";
    if (roll < 0.24) return "flyback";
    return null; // an ordinary day at the office
};

const clean = async () => {
    await pool.query("DELETE FROM users WHERE employee_id LIKE 'DEMO\\_%'");
    await pool.query("DELETE FROM projects WHERE name = ANY($1)", [
        PROJECTS.map((p) => p.name),
    ]);
};

const seedDemo = async () => {
    await setupDatabase();
    await clean();

    const hashed = await bcrypt.hash(PASSWORD, 10);

    // --- projects -----------------------------------------------------------
    const projectIds = {};
    for (const project of PROJECTS) {
        const { rows } = await pool.query(
            `INSERT INTO projects (name, description, status)
             VALUES ($1, $2, 'active') RETURNING id`,
            [project.name, project.description],
        );
        projectIds[project.name] = rows[0].id;
    }

    // --- people (leads first, so employees can point at them) ---------------
    const userIds = {};
    for (const person of [...PEOPLE].sort((a, b) => (a.role === "lead" ? -1 : 1))) {
        const { rows } = await pool.query(
            `INSERT INTO users
                 (employee_id, first_name, last_name, email, phone, department,
                  designation, joining_date, password, role, lead_id, account_status)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'active')
             RETURNING id`,
            [
                person.id,
                person.first,
                person.last,
                `${person.first}.${person.last}`.toLowerCase() + "@trackify.demo",
                "+91 90000 00000",
                person.dept,
                person.title,
                "2024-01-15",
                hashed,
                person.role,
                person.lead ? userIds[person.lead] : null,
            ],
        );
        userIds[person.id] = rows[0].id;
    }

    // --- leads on projects --------------------------------------------------
    for (const person of PEOPLE.filter((p) => p.role === "lead")) {
        await pool.query(
            `INSERT INTO project_leads (project_id, lead_id)
             VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [projectIds[person.project], userIds[person.id]],
        );
    }

    const projectOf = (person) => {
        const lead = PEOPLE.find((p) => p.id === person.lead);
        return projectIds[lead?.project ?? "CWC"];
    };

    // --- attendance: the last ~6 weeks of weekdays --------------------------
    const start = new Date();
    start.setDate(start.getDate() - 44);
    const workdays = eachWorkingDay(toISODate(start), todayISO());

    let seed = 7;
    let attendanceRows = 0;

    for (const person of PEOPLE) {
        const rand = makeRandom((seed += 101));
        const projectId =
            person.role === "lead" ? projectIds[person.project] : projectOf(person);

        for (const day of workdays) {
            const status = pickException(rand);
            if (!status) continue;

            await pool.query(
                `INSERT INTO attendance (user_id, project_id, work_date, status)
                 VALUES ($1, $2, $3::date, $4)
                 ON CONFLICT (user_id, work_date) DO NOTHING`,
                [userIds[person.id], projectId, day, status],
            );
            attendanceRows += 1;
        }
    }

    // --- leave requests in every state --------------------------------------
    const offset = (days) => {
        const d = new Date();
        d.setDate(d.getDate() + days);
        return toISODate(d);
    };

    const leaves = [
        // Pending, waiting on a lead.
        { who: "DEMO_E01", type: "leave", from: offset(7), to: offset(9), reason: "Family wedding.", status: "pending" },
        { who: "DEMO_E04", type: "wfh", from: offset(2), to: offset(2), reason: "Engineer visiting to fix the boiler.", status: "pending" },
        { who: "DEMO_E06", type: "wfh", from: offset(-4), to: offset(-2), reason: "Focus week on the migration.", status: "approved", by: "DEMO_L03" },
        { who: "DEMO_E04", type: "sick", from: offset(3), to: offset(3), reason: "Doctor's appointment.", status: "pending" },
        { who: "DEMO_E07", type: "flyback", from: offset(12), to: offset(14), reason: "Quarterly flyback home.", status: "pending" },
        // Pending, waiting on the admin (a lead's own request).
        { who: "DEMO_L02", type: "leave", from: offset(20), to: offset(24), reason: "Annual leave.", status: "pending" },
        // Approved — these also write attendance days.
        { who: "DEMO_E02", type: "leave", from: offset(-12), to: offset(-10), reason: "Short break.", status: "approved", by: "DEMO_L01" },
        { who: "DEMO_E09", type: "flyback", from: offset(-20), to: offset(-18), reason: "Flyback home.", status: "approved", by: "DEMO_L04" },
        { who: "DEMO_L03", type: "leave", from: offset(-30), to: offset(-28), reason: "Family time.", status: "approved", by: null },
        // Rejected.
        { who: "DEMO_E05", type: "other", from: offset(-5), to: offset(-5), reason: "Personal errand.", status: "rejected", by: "DEMO_L02" },
    ];

    for (const leave of leaves) {
        const person = PEOPLE.find((p) => p.id === leave.who);
        const approverId =
            person.role === "employee" ? userIds[person.lead] : null;
        const decidedBy = leave.by ? userIds[leave.by] : null;

        const { rows } = await pool.query(
            `INSERT INTO leave_requests
                 (user_id, project_id, leave_type, start_date, end_date, reason,
                  status, approver_id, approved_by, rejection_reason)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             RETURNING id`,
            [
                userIds[leave.who],
                person.role === "lead"
                    ? projectIds[person.project]
                    : projectOf(person),
                leave.type,
                leave.from,
                leave.to,
                leave.reason,
                leave.status,
                approverId,
                leave.status === "approved"
                    ? (decidedBy ??
                        (await pool.query(
                            "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
                        )).rows[0]?.id)
                    : leave.status === "rejected"
                        ? decidedBy
                        : null,
                leave.status === "rejected" ? "We need cover that week." : null,
            ],
        );

        // An approved leave owns its days in attendance — the same rule the
        // approval endpoint applies, so the demo matches what the app produces.
        if (leave.status === "approved") {
            const days = eachWorkingDay(leave.from, leave.to);
            if (days.length) {
                await pool.query(
                    `INSERT INTO attendance
                         (user_id, project_id, work_date, status, notes,
                          leave_request_id)
                     SELECT $1, $2, day::date, $4, $5, $6
                       FROM UNNEST($3::date[]) AS day
                     ON CONFLICT (user_id, work_date) DO UPDATE
                     SET status = EXCLUDED.status,
                         leave_request_id = EXCLUDED.leave_request_id`,
                    [
                        userIds[leave.who],
                        person.role === "lead"
                            ? projectIds[person.project]
                            : projectOf(person),
                        days,
                        leave.type === "flyback" ? "flyback" : "on_leave",
                        `${leave.type} leave`,
                        rows[0].id,
                    ],
                );
            }
        }
    }

    console.log("Demo data seeded:");
    console.log(`  ${PROJECTS.length} projects: ${PROJECTS.map((p) => p.name).join(", ")}`);
    console.log(`  ${PEOPLE.filter((p) => p.role === "lead").length} leads, ${PEOPLE.filter((p) => p.role === "employee").length} employees`);
    console.log(`  ~${attendanceRows} attendance days, ${leaves.length} leave requests`);
    console.log(`\n  Every demo account signs in with password: ${PASSWORD}`);
    console.log("  Try:  DEMO_L01 (lead, Priya)   DEMO_E01 (employee, Ananya)");
    console.log(`  Admin: ${process.env.ADMIN_EMPLOYEE_ID || "ADMIN001"}`);
};

module.exports = seedDemo;

if (require.main === module) {
    seedDemo()
        .then(() => pool.end())
        .catch((error) => {
            console.error("Seeding failed:", error);
            process.exit(1);
        });
}
