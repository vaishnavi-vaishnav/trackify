# 📄 Trackify

<div align="center">

### Professional Employee Attendance Management Platform

A modern full-stack Employee Attendance Management System that streamlines workforce attendance tracking, employee administration, and daily attendance monitoring through secure authentication, role-based dashboards, and an intuitive user experience.

![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&style=flat-square)
![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&style=flat-square)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-38BDF8?logo=tailwindcss&style=flat-square)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?logo=node.js&style=flat-square)
![Express](https://img.shields.io/badge/Express-5-000000?logo=express&style=flat-square)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&style=flat-square)
![JWT](https://img.shields.io/badge/Auth-JWT-orange?logo=jsonwebtokens&style=flat-square)
![License](https://img.shields.io/badge/License-MIT-yellow?style=flat-square)

</div>

<p align="center">
  <a href="https://trackify-frontend-tla4.onrender.com" target="_blank" rel="noopener noreferrer">🔗 Live Demo</a>
</p>

<p align="center">
  <img src="screenshots/home-page.gif" alt="Trackify in action — from login to dashboard" width="100%">
</p>

## 📖 Project Overview

Trackify is a full-stack **workforce attendance and leave management system**. It tracks how people actually spend their working days — in the office, from home, on a flyback, or on leave — and rolls those days up into reports by employee, by lead, by project and by month.

The organisation is modelled as a hierarchy:

```text
Project (CWC, SAIL …)
  └── many Leads
        └── many Employees
```

A project runs with **several leads**, and each lead owns **their own team of employees**. That reporting line is what everything else keys off:

- **Employees** mark each working day, check in and out, and request leave. Their request goes to **their lead**.
- **Leads** see only their own team — today's attendance, monthly and weekly breakdowns per person — and approve or reject their team's leave. A lead's *own* leave request goes up to the **admin**.
- **Admins** manage projects, leads, teams and every account, and can slice attendance reporting by project, by lead, by employee and by month.

Approving leave writes those days straight into attendance, so "days on leave" and "flyback days" are counted from a single source of truth rather than kept in step by hand.

Built with **React, Node.js, Express.js, and PostgreSQL**, with JWT authentication, role-scoped APIs, full CRUD on every entity, input validation, and an audit trail on every change.

---

## ✨ Key Features

| Area | Feature | What it does | Why it matters |
|------|---------|--------------|----------------|
| 👤 **Employee** | Secure account activation | Employees activate pending accounts and set their own password | Admins never see employee passwords |
| | Day-status marking | Mark each day as **office**, **home** or **flyback**, against a project | This is the number every report counts |
| | Check-in / check-out | Start and end the working day, with office-hours guardrails | Captures hours alongside the day's status |
| | Personal dashboard | Live hours gauge, this week's bars, this month's totals | Employees see where their day and month stand |
| | Attendance history | Month picker, monthly totals, week-by-week table, day-by-day log | Full self-service record keeping |
| | Leave requests | Request, track and withdraw leave; see who decided and why | No chasing anyone for a status update |
| 👨‍💼 **Lead** | Team dashboard | Their team only — today's status plus the month's breakdown per person | A lead sees exactly their own people, nobody else's |
| | Team attendance | Any past day, with the ability to correct a team member's day | Fixes missed check-ins without an admin |
| | Leave approvals | Approve or reject their team's requests, with a required reason on reject | The person closest to the work decides |
| | Team reports | Per-person office / home / flyback / leave / absent counts by month and project | Answers "how did my team spend March?" |
| | Their own leave | Raised like anyone else's — but routed **up to the admin** | A lead never approves their own leave |
| 🏢 **Admin** | Projects | Full CRUD, **many leads per project**, plus optional departments | Mirrors how delivery actually runs |
| | Leads & teams | Assign employees under a lead, move them, detach them | The reporting line drives approvals and reporting |
| | People directory | One directory for **employees, leads and admins**, with role and status filters | Every account managed in one place |
| | Full account CRUD | Create, edit, change role, reassign lead, deactivate, delete | Nothing needs a database console |
| | Org-wide reporting | Slice by **project**, **lead**, **employee** and **month**; drill into any person | Answers project-, lead- and person-level questions |
| | Leave escalations | Owns the queue for leads' own requests; can oversee every request | Every request has exactly one owner |
| 📊 **Reporting** | Single source of truth | Approving leave writes `on_leave` / `flyback` days into attendance | Leave and attendance can never disagree |
| | Monthly & weekly views | Month totals, ISO-week buckets, and the day-by-day log behind them | The exact breakdowns asked of a timesheet |
| | Role-scoped by design | The server derives scope from the caller, ignoring client-supplied filters | A lead cannot read another lead's team |
| 🔒 **Security** | JWT + live account check | Every request re-reads the account; `token_version` revokes live sessions | Deactivating someone signs them out immediately |
| | Password hashing | bcrypt with 10 salt rounds | Industry-standard password storage |
| | Role-based authorization | `adminOnly` / `leadOrAdmin` middleware plus per-record ownership checks | Least privilege, enforced per row and not just per route |
| | Audit trail | Every create, update, approval and deletion is logged with actor and IP | Complete compliance history |
| | Input validation | `express-validator` on mutating routes; typed errors elsewhere | Prevents malformed and malicious payloads |
| | CORS allow-listing | Configurable comma-separated origin list | Restricts which browsers may call the API |

---

## 📸 Screenshots

### 🔐 Employee Login

Employees and administrators sign in with their Employee ID and password on a polished split-screen page — with the product value proposition presented alongside the form.

<p align="center">
  <img src="screenshots/login-page.png" width="100%" alt="Trackify employee login page">
</p>

---

### 📊 Administrator Dashboard

The admin dashboard gives a real-time overview of the workforce: total employees, how many are working today, how many have completed their day, and how many have not yet started — alongside a "Today's workforce breakdown" donut chart and a live team snapshot.

<p align="center">
  <img src="screenshots/admin-dashboard.png" width="100%" alt="Trackify administrator dashboard">
</p>

---

### 👥 Employee Management

Administrators manage the whole team from a centralized, searchable directory — filter by status (All / Active / Inactive / Pending), edit profiles, and activate or deactivate accounts with a confirmation prompt.

<p align="center">
  <img src="screenshots/employee-management-page.png" width="100%" alt="Trackify employee management page">
</p>

---

### ➕ Add Employee

Registering a new employee is straightforward. New accounts start in a **pending** state — the employee activates their own password before their first sign-in.

<p align="center">
  <img src="screenshots/add-employee-page.png" width="100%" alt="Trackify add employee page">
</p>

---

### ✏️ Edit Employee

Updating an employee's details is just as simple. The pre-filled form keeps the **Employee ID** read-only — the unique identifier can never be changed — while name, email, phone, department, and designation remain fully editable. Changes apply immediately on save.

<p align="center">
  <img src="screenshots/edit-employee.png" width="100%" alt="Trackify edit employee page">
</p>

---

### 🔑 Account Activation

New employees activate their pending account using the Employee ID issued by their administrator. Setting their own password completes sign-up and moves the account to an **active** state — admins never see employee passwords.

<p align="center">
  <img src="screenshots/account-activation-page.png" width="100%" alt="Trackify account activation page">
</p>

---

### 👨‍💼 Employee Dashboard

Employees monitor their day through a personalized dashboard — current work status, check-in time, working hours toward an 8-hour target, a weekly bar chart, and recent days.

<p align="center">
  <img src="screenshots/employee-dashboard.png" width="100%" alt="Trackify employee dashboard">
</p>

---

### 📅 Attendance History

Every check-in and check-out, month by month. Employees filter by month and see days worked, hours logged, average hours per day, and the full detailed breakdown.

<p align="center">
  <img src="screenshots/employee-attendance-history.png" width="100%" alt="Trackify employee attendance history">
</p>

---

## 🛠️ Technology Stack

| Category | Technology | Purpose |
|----------|-----------|---------|
| **Frontend** | React 19 | Component-based UI |
| | React Router 7 | Client-side routing & route guards |
| | Axios | HTTP client with interceptors |
| | Tailwind CSS 4 | Utility-first styling with design tokens |
| | Vite 8 | Build tooling & dev server |
| | lucide-react | Lightweight icon set |
| | react-toastify | In-app notifications |
| **Backend** | Node.js + Express 5 | REST API server |
| | PostgreSQL (pg) | Relational database |
| | jsonwebtoken | JWT signing & verification |
| | bcrypt | Password hashing |
| | express-validator | Request validation |
| | cors | Cross-origin resource sharing |
| | dotenv | Environment configuration |
| **Dev Tools** | nodemon | Auto-restarting dev server |

---

## 🏗️ System Architecture

```text
                       React Frontend (Vite + Tailwind)
                              │
                              ▼
                  React Router (lazy-loaded routes)
                              │
                              ▼
                   Axios HTTP Requests (REST API)
                   └── 401 interceptor → auto-logout
                              │
                              ▼
                 Express.js Backend (Node.js)
                    └── CORS allow-list + JWT middleware
                              │
      ┌───────────────────────┼────────────────────────┐
      ▼                       ▼                        ▼
 Authentication         Attendance Module          Admin Module
  /api/auth             /api/attendance            /api/admin
 (JWT + bcrypt)         (office-hours guard)   (adminOnly middleware)
      │                       │                        │
      └───────────────────────┼────────────────────────┘
                              ▼
                       PostgreSQL Database
                              │
              ┌───────────────┼────────────────┐
              ▼               ▼                ▼
            users        attendance      leave_requests
```

---

## 📂 Project Structure

```text
Trackify/
│
├── client/                          # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                  # Button, Table, Modal, Select, StatCard,
│   │   │   │                        #   Pagination, FilterChips, SearchInput
│   │   │   ├── charts/              # Donut, RadialGauge, HoursBars
│   │   │   ├── reports/             # BreakdownTable, FilterBar
│   │   │   ├── leave/               # LeaveRequestCard, LeaveRequestModal
│   │   │   ├── projects/            # ProjectFormModal (create + edit)
│   │   │   ├── forms/               # EmployeeForm, PersonFormModal
│   │   │   └── layout/              # AppShell, Sidebar, Topbar, PageHeader
│   │   ├── context/                 # AuthContext, NotificationContext
│   │   ├── hooks/                   # useDebouncedValue, useClickOutside, …
│   │   ├── pages/
│   │   │   ├── admin/               # Dashboard, Reports, People,
│   │   │   │                        #   Projects + ProjectDetail,
│   │   │   │                        #   Leads + LeadDetail
│   │   │   ├── lead/                # Dashboard, TeamAttendance, Reports
│   │   │   ├── employee/            # Dashboard, AttendanceHistory, LeaveRequest
│   │   │   ├── leave/               # ApprovalQueue (shared by lead + admin)
│   │   │   ├── reports/             # EmployeeDetail (shared drill-down)
│   │   │   └── Landing, Login, Activate, 404
│   │   ├── routes/                  # Lazy routes + Protected/Lead/Admin guards
│   │   ├── services/                # api, auth, admin, attendance, projects,
│   │   │                            #   leads, leave, reports
│   │   ├── lib/                     # format (dates), status (vocabulary), nav
│   │   ├── styles/                  # Tailwind v4 design tokens (@theme)
│   │   ├── App.jsx
│   │   └── main.jsx
│   └── .env.example
│
├── server/                          # Express backend
│   ├── src/
│   │   ├── config/                  # companyPolicy (office hours)
│   │   ├── controllers/             # auth, admin, attendance, leave,
│   │   │                            #   project, lead, report
│   │   ├── database/                # schema.sql, setup.js, seedDemo.js, db.js
│   │   ├── middleware/              # auth (JWT), adminOnly, leadOrAdmin, validation
│   │   ├── models/                  # Data access layer (one per entity)
│   │   ├── routes/                  # /auth /admin /attendance /projects
│   │   │                            #   /leads /leave /reports
│   │   ├── services/                # Business logic + authorization decisions
│   │   ├── utils/                   # AppError, dates, breakdown helpers
│   │   ├── validations/             # express-validator schemas
│   │   ├── app.js                   # Express app + CORS + error handling
│   │   └── server.js                # Entry point
│   └── .env.example
│
├── screenshots/                     # README screenshots
├── README.md
├── LICENSE
└── .gitignore
```

---

## ⚙️ Installation & Setup

### 1️⃣ Prerequisites

- **Node.js** 20+ and **npm**
- **PostgreSQL** 14+ running locally

### 2️⃣ Clone the Repository

```bash
git clone https://github.com/Aby020/Trackify.git
cd Trackify
```

### 3️⃣ Install Backend Dependencies

```bash
cd server
npm install
```

### 4️⃣ Install Frontend Dependencies

Open a new terminal.

```bash
cd client
npm install
```

### 5️⃣ Configure Environment Variables

Inside the **server** folder, copy the example file and fill in your database credentials:

```bash
cd server
cp .env.example .env
```

```env
PORT=5000
DATABASE_URL=postgresql://postgres:password@localhost:5432/trackify_db
JWT_SECRET=your_secret_key
```

Then inside the **client** folder:

```bash
cd client
cp .env.example .env
```

```env
VITE_API_URL=http://localhost:5000/api
```

### 6️⃣ Set Up the Database

The schema and admin account are **bootstrapped automatically** on the first server start — the setup is idempotent, so it is safe to run on every boot. You can also trigger it manually:

```bash
cd server
npm run db:setup
```

**Optional — load a demo organisation.** This gives every screen something real to show: two projects (`CWC`, `SAIL`), two leads on each, a team under every lead, about six weeks of attendance, and leave requests in every state.

```bash
cd server
npm run db:seed:demo
```

It is safe to re-run — it replaces the data it owns rather than duplicating it. All demo accounts sign in with `Password@123`; try `DEMO_L01` (a lead) and `DEMO_E01` (an employee).

### 7️⃣ Start the Backend Server

```bash
cd server
npm run dev
```

Backend runs on:

```
http://localhost:5000
```

### 8️⃣ Start the Frontend

```bash
cd client
npm run dev
```

Frontend runs on:

```
http://localhost:5173
```

---

## 🔐 Environment Variables

### Backend (`server/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Backend server port | No (default: `5000`) |
| `NODE_ENV` | Environment mode | No (default: `development`) |
| `DATABASE_URL` | PostgreSQL connection string | Yes* |
| `DB_HOST` / `DB_PORT` / `DB_USER` / `DB_PASSWORD` / `DB_NAME` | Individual database variables (used if `DATABASE_URL` is not set) | Yes* |
| `JWT_SECRET` | Secret key for JWT tokens (32+ random bytes) | Yes |
| `CORS_ORIGIN` | Comma-separated allowed browser origins | No (default: `http://localhost:5173`) |
| `ADMIN_EMAIL` | Bootstrap admin email | No (default: `admin@trackify.app`) |
| `ADMIN_EMPLOYEE_ID` | Bootstrap admin employee ID | No (default: `ADMIN001`) |
| `ADMIN_PASSWORD` | Bootstrap admin password | No (default: `TrackifyDev2026`) |
| `ATTENDANCE_ENFORCE_HOURS` | Enforce office-hours check-in/check-out (`true`/`false`) | No (default: `true`) |
| `FRONTEND_URL` | Base URL used to build activation links in emails | No (default: `http://localhost:5173`) |
| `EMAIL_SERVICE` / `EMAIL_USER` / `EMAIL_PASSWORD` / `EMAIL_FROM` | Nodemailer transport for activation emails | Only to email activation links |

*Either `DATABASE_URL` **or** all `DB_*` variables are required.

Generate a strong secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Frontend (`client/.env`)

| Variable | Description | Required |
|----------|-------------|----------|
| `VITE_API_URL` | Backend API base URL (includes the `/api` prefix) | No (default: `http://localhost:5000/api`) |

---

## 🚀 Running the Project

1. Ensure PostgreSQL is running and the database exists (see [Installation](#installation--setup)).
2. Start the backend: `cd server && npm run dev` → `http://localhost:5000`
3. Start the frontend: `cd client && npm run dev` → `http://localhost:5173`
4. Open `http://localhost:5173` in your browser.

> The admin account is **created automatically** on the first server start from your environment variables. Use it to log in, add employees, and explore the dashboard.

---

## 🧑‍💼 Default Admin Credentials

> ⚠️ **Development only.** These defaults ship for local development. **Change them in production** by setting `ADMIN_EMAIL`, `ADMIN_EMPLOYEE_ID`, and `ADMIN_PASSWORD` in `server/.env` — the account is re-synced from these variables on every server start.

| Credential | Value |
|------------|-------|
| **Employee ID** | `ADMIN001` |
| **Password** | `TrackifyDev2026` |
| **Email** | `admin@trackify.app` |
| **Role** | Admin |

---

## 👥 User Roles

| | 🏢 Admin | 👨‍💼 Lead | 👤 Employee |
|---|---|---|---|
| **Sign in** | ✅ | ✅ (after activation) | ✅ (after activation) |
| **Mark own day / check in / out** | ✅ | ✅ | ✅ |
| **Own attendance history & summaries** | ✅ | ✅ | ✅ |
| **Request leave** | ✅ | ✅ (→ admin) | ✅ (→ their lead) |
| **See their team's attendance** | ✅ (any team) | ✅ (own team only) | ❌ |
| **Correct a team member's day** | ✅ (anyone) | ✅ (own team only) | ❌ |
| **Approve / reject leave** | ✅ (leads' requests, and any) | ✅ (own team only) | ❌ |
| **Team reports (monthly / weekly)** | ✅ (everyone) | ✅ (own team only) | own only |
| **Lead-wise & project-wise reports** | ✅ | ❌ | ❌ |
| **Create / edit / delete accounts** | ✅ | ❌ | ❌ |
| **Assign employees to a lead** | ✅ | ❌ | ❌ |
| **Create projects, assign leads** | ✅ | ❌ | ❌ |

Scope is enforced on the server, not in the UI. Routes are guarded by `authenticate` + `adminOnly` / `leadOrAdmin`, and every team- or person-scoped read is *derived from the caller* rather than taken from a client-supplied `leadId` — a lead asking for another lead's team gets a `403`, not someone else's data.

Guard rails worth knowing:

- Nobody can approve their own leave request.
- Only the approver a request was routed to (or an admin) can decide it.
- A lead with employees still reporting to them cannot be demoted or deleted.
- The last admin account cannot be deleted.
- Deactivating an account invalidates its live sessions immediately.

---

## 🔄 Feature Workflow

### 🧑‍💼 Employee Lifecycle

```text
Admin creates employee ──► status = pending ──► Employee activates account
      (no password)              │                    (sets own password)
                                 ▼
                        status = active ──► Can log in & mark attendance
                                 │
                                 └──► Admin can deactivate at any time (login blocked)
```

### 📅 Daily Attendance Flow

Each person has **exactly one attendance row per calendar day**, carrying a status and (for days worked) clocked hours:

| Status | Meaning |
|--------|---------|
| `wfo` | Worked from office |
| `wfh` | Worked from home |
| `flyback` | Flyback day |
| `on_leave` | On approved leave |
| `absent` | Absent |

```text
Employee marks the day ──► wfo / wfh / flyback        (counted in every report)
        │
        └──► Start work ──► check_in recorded, hours accrue
                  └──► End work ──► total_hours calculated
```

Office-hours guardrails apply to check-in/out: check-in from **8:30 AM**, check-out from **5:00 PM**. Set `ATTENDANCE_ENFORCE_HOURS=false` in `server/.env` to lift them for demos and testing.

### 🗓️ Leave Approval Flow

Leave routes one step up the reporting line. The target is captured when the request is raised, so it stays in the queue it was filed into even if the reporting line later changes.

```text
Employee requests leave ──► routed to THEIR LEAD ──► lead approves / rejects
                                                          │
Lead requests leave ──────► routed to the ADMIN ──────────┤
                                                          ▼
                                        Approved ──► working days written into
                                                     attendance as on_leave
                                                     (or flyback for a flyback leave)
```

- Weekends inside a range are skipped, so a Friday-to-Monday leave counts as two days, not four.
- Cancelling an approved leave removes exactly the days it created.
- Overlapping requests are rejected up front.

### 🏢 Admin Setup (first run)

1. **Create projects** (e.g. `CWC`, `SAIL`)
2. **Add people** — pick the role: employee, lead or admin
3. **Assign leads to projects** — a project can have several
4. **Assign employees under a lead** in *Leads & Teams*
5. People **activate their accounts** and start marking days
6. **Reports** answers project-, lead-, person- and month-level questions

---

## 🔌 API Overview

All routes return JSON. Mutating routes validate the request body with `express-validator`. Admin routes require the `admin` role.

**List endpoints are paged.** `/api/admin/employees`, `/api/projects` and `/api/leads` accept `page`, `pageSize` and `search`, and return the rows in `data` beside a `meta` block:

```jsonc
{
  "data": [ /* … one page of rows … */ ],
  "meta": {
    "page": 1, "pageSize": 20, "total": 184, "totalPages": 10,
    "counts": { "employees": 160, "leads": 23, "admins": 1, "unassigned": 4 }
  }
}
```

`counts` describes the whole dataset regardless of the current filters, which is what the filter chips display. Searching and filtering happen in SQL, so a large directory stays one small response. Pickers that genuinely need every row (a "choose a lead" dropdown) pass `pageSize=all`, which is still capped server-side.

### 🔐 Authentication — `/api/auth`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/auth/send-activation-link` | Email an activation link | — |
| `POST` | `/api/auth/activate` | Activate a pending account (set password) | — |
| `POST` | `/api/auth/login` | Sign in, returns a JWT + user | — |
| `GET` | `/api/auth/me` | The signed-in account as the server sees it now | Any |

### 👥 People — `/api/admin`

One directory covers every account; `?role=` narrows it to `employee`, `lead` or `admin`.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/admin/dashboard` | Organisation statistics | Admin |
| `GET` | `/api/admin/employees` | Directory (`?role=` `?status=` `?search=` `?leadId=` `?unassigned=` `?page=` `?pageSize=`) | Admin |
| `GET` | `/api/admin/employees/:employeeId` | One account | Admin |
| `POST` | `/api/admin/employees` | Create (accepts `role` and `leadId`) | Admin |
| `PUT` | `/api/admin/employees/:employeeId` | Update profile, role or reporting line | Admin |
| `DELETE` | `/api/admin/employees/:employeeId` | Delete an account | Admin |
| `PATCH` | `/api/admin/employees/:employeeId/status` | Activate / deactivate | Admin |

### 🏢 Projects — `/api/projects`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/projects` | Projects with lead and headcount totals (`?search=` `?status=` `?page=` `?pageSize=`) | Any |
| `GET` | `/api/projects/:id` | Project with its leads, people and departments | Any |
| `POST` `PUT` `DELETE` | `/api/projects[/:id]` | Create / update / delete | Admin |
| `POST` | `/api/projects/:id/leads` | Assign a lead (a project may have many) | Admin |
| `DELETE` | `/api/projects/:id/leads/:leadId` | Remove a lead | Admin |
| `GET` `POST` `PUT` `DELETE` | `/api/projects/:id/departments[/:deptId]` | Department CRUD | Admin (reads: any) |

### 👨‍💼 Leads & teams — `/api/leads`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/leads` | Leads with team size and projects (`?search=` `?projectId=` `?page=` `?pageSize=`) | Lead / Admin |
| `GET` | `/api/leads/unassigned-employees` | Employees with no lead yet | Admin |
| `GET` | `/api/leads/:leadId` | A lead with their team and projects | Own team / Admin |
| `GET` | `/api/leads/:leadId/employees` \| `/projects` | Team members / projects | Own team / Admin |
| `POST` | `/api/leads/:leadId/employees` | Assign an employee to this lead | Admin |
| `DELETE` | `/api/leads/:leadId/employees/:userId` | Detach an employee | Admin |

### 📊 Attendance — `/api/attendance`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/attendance/today` | Today's own record | Any |
| `GET` | `/api/attendance/history` | Own history (`?startDate`, `?endDate`, `?projectId`) | Any |
| `GET` | `/api/attendance/me/summary` | Own month: records, totals and weekly buckets | Any |
| `POST` | `/api/attendance/start` \| `/end` | Check in / check out | Any |
| `POST` | `/api/attendance/mark` | Set a day's status (`employeeId` to act for a report) | Any / Lead / Admin |
| `GET` | `/api/attendance/team` | One day across a team (`?workDate`, `?leadId`) | Lead / Admin |
| `DELETE` | `/api/attendance/:workDate` | Remove a day's record | Lead / Admin |

### 🗓️ Leave — `/api/leave`

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `POST` | `/api/leave/request` | Raise a request (auto-routed to lead or admin) | Any |
| `GET` | `/api/leave/my-requests` | Own requests | Any |
| `GET` | `/api/leave/queue` | The caller's approval queue (`?status`, `?scope=all`) | Lead / Admin |
| `GET` `PUT` `DELETE` | `/api/leave/:id` | Read / edit a pending request / delete (admin) | Owner / Approver |
| `POST` | `/api/leave/:id/approve` \| `/reject` | Decide (reject requires a reason) | Approver / Admin |
| `POST` | `/api/leave/:id/cancel` | Withdraw, clearing any attendance days it wrote | Owner / Approver |

### 📈 Reports — `/api/reports`

Every report is scoped server-side to the caller: an employee gets only their own numbers, a lead only their team's.

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/reports/overview` | Today's shape plus the month's totals | Any |
| `GET` | `/api/reports/employees` | Per-person breakdown (`?month`, `?projectId`, `?leadId`) | Lead / Admin |
| `GET` | `/api/reports/employees/:userId` | One person's month, weeks, days and leave | Self / Lead / Admin |
| `GET` | `/api/reports/leads` | Lead-wise rollup (`?month`, `?projectId`) | Admin |
| `GET` | `/api/reports/projects` | Project-wise rollup (`?month`) | Admin |
| `GET` | `/api/reports/my-week` | The caller's current week | Any |

**Example — login:**

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"employeeId":"ADMIN001","password":"TrackifyDev2026"}'
```

**Example — protected route (Bearer token):**

```bash
curl http://localhost:5000/api/admin/dashboard \
  -H "Authorization: Bearer <your-jwt-token>"
```

---

## 🗄️ Database Overview

Seven tables make up the PostgreSQL schema (`server/src/database/schema.sql`), applied idempotently on server start — including in-place migrations for databases created against earlier versions.

### 👥 `users`

One row per account. Employees, leads and admins all live in a single table, separated by `role`. `lead_id` is the reporting line — it points at the lead an employee reports to, and is `NULL` for leads and admins.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL | Primary key |
| `employee_id` | VARCHAR(20) | **UNIQUE** — used for login & activation |
| `first_name` / `last_name` | VARCHAR(100) | Name |
| `email` | VARCHAR(150) | **UNIQUE** |
| `phone` | VARCHAR(20) | Optional |
| `department` / `designation` | VARCHAR(100) | Position within the company |
| `joining_date` | DATE | Optional |
| `password` | TEXT | bcrypt hash; `NULL` while pending |
| `role` | VARCHAR(20) | `admin` \| `lead` \| `employee` |
| `lead_id` | INT | FK → `users(id)` — who approves this person's leave |
| `account_status` | VARCHAR(20) | `pending` → `active` / `inactive` |
| `token_version` | INT | Bumped on deactivation to revoke live sessions |
| `created_at` / `updated_at` | TIMESTAMP | Auditing |

### 🏢 `projects`, `departments`, `project_leads`

`projects` holds each programme of work. `project_leads` is the many-to-many join that lets a project run with **several leads**, optionally scoped to a `department` (which is itself project-scoped).

### 📅 `attendance`

**Exactly one row per person per calendar day** — `UNIQUE (user_id, work_date)`. `project_id` records which project the day was booked against, but it is an attribute of the day rather than part of its identity: keying per project would count the same day once for every project a person touches, and inflate every monthly total.

| Column | Type | Notes |
|--------|------|-------|
| `id` | SERIAL | Primary key |
| `user_id` | INT | FK → `users(id)`, `ON DELETE CASCADE` |
| `project_id` | INT | FK → `projects(id)`, `ON DELETE SET NULL` |
| `work_date` | DATE | With `user_id`, forms the **UNIQUE** constraint |
| `status` | VARCHAR(20) | `wfo` \| `wfh` \| `present` \| `on_leave` \| `flyback` \| `absent` |
| `check_in` / `check_out` | TIMESTAMP | Punch times |
| `total_hours` | DECIMAL(5,2) | Auto-calculated on check-out |
| `check_in_status` | VARCHAR(20) | `inactive` / `working` / `completed` |
| `leave_request_id` | INT | Set when an approved leave produced this day |

### 🏖️ `leave_requests`

The full approval workflow. `approver_id` is the routing target captured when the request is raised — the requester's lead, or `NULL` for the admin queue. Storing it (rather than re-deriving it from `users.lead_id`) keeps a request in the queue it was filed into even if the reporting line later changes.

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | INT | Who requested it |
| `leave_type` | VARCHAR(20) | `leave` \| `sick` \| `flyback` \| `other` |
| `start_date` / `end_date` | DATE | Inclusive range |
| `status` | VARCHAR(20) | `pending` \| `approved` \| `rejected` \| `cancelled` |
| `approver_id` | INT | Routed to; `NULL` means the admin queue |
| `approved_by` | INT | Who actually decided it |
| `approval_notes` / `rejection_reason` | TEXT | The decision's rationale |

### 📝 `audit_logs`

Every create, update, approval and deletion, with the acting user, a JSONB diff, IP address and user agent.

### 🔍 Indexes

```text
idx_users_role / idx_users_lead     ON users(role) / users(lead_id)
idx_attendance_user_day             ON attendance(user_id, work_date DESC)
idx_attendance_project              ON attendance(project_id, work_date DESC)
idx_leave_approver                  ON leave_requests(approver_id, status)
idx_leave_admin_queue               ON leave_requests(status) WHERE approver_id IS NULL
idx_project_leads                   ON project_leads(project_id, lead_id)
idx_audit_entity / idx_audit_user   ON audit_logs(…, created_at DESC)
```

---

## 🔒 Security Features

| Feature | Implementation |
|---------|----------------|
| **JWT authentication** | Signed tokens with `{ id, employeeId, role }` claims and an **8-hour expiry** |
| **Password hashing** | bcrypt with **10 salt rounds** — raw passwords are never stored |
| **Role-based access control** | `adminOnly` middleware denies employee tokens on admin routes |
| **Deny-by-default sessions** | `account_status` gates login; `pending` and `inactive` accounts are rejected |
| **Input validation** | `express-validator` on every mutating endpoint |
| **CORS allow-list** | Only configured origins may call the API (`CORS_ORIGIN`) |
| **401 auto-logout** | Axios response interceptor clears the session and redirects to login |
| **Token invalidation** | `token_version` supports revoking issued tokens |
| **No secrets in code** | All configuration via environment variables (`.env` is git-ignored) |

---

## 🚀 Future Enhancements

- 📱 **Mobile application** — native iOS & Android companions
- 📊 **Advanced attendance analytics** — trends, reports, and exports
- 📍 **GPS-based attendance tracking** — location-verified check-ins
- 🖐️ **Biometric attendance integration** — fingerprint / face recognition
- 📧 **Email notifications** — activation reminders and daily digests
- 📈 **Employee performance dashboard** — productivity insights
- 🐳 **Docker deployment** — containerized server + database
- ☁️ **Cloud deployment** — production-ready hosting guide
- 🌐 **API documentation** — OpenAPI / Swagger specification
- 🏖️ **Leave management** — end-to-end leave request workflow

---

## 🌟 Project Highlights

- **Secure by design** — JWT + bcrypt + role-based authorization + validated input, end to end
- **Real office-hour enforcement** — configurable 9–5 attendance window with early check-in
- **Idempotent bootstrapping** — schema and admin account self-configure on every start
- **Polished design system** — Tailwind v4 design tokens with a modern indigo/violet brand
- **Reactive session handling** — expired tokens log the user out gracefully via a custom event
- **Complete role separation** — distinct employee and admin experiences with strict access control
- **Responsive and modern** — mobile-friendly, component-driven React architecture

---

## 📄 License

This project is licensed under the **MIT License**.

See the **[LICENSE](LICENSE)** file for more information.

---

## 👨‍💻 Author

<div align="center">

### Abi Thomas

**Backend Developer | Python, Django & Node.js Developer**

Passionate about building scalable backend systems, RESTful APIs, modern web applications, and production-ready software using Python, Django, Node.js, Express.js, PostgreSQL, and React.

<p>

<a href="https://github.com/Aby020">
<img src="https://img.shields.io/badge/GitHub-Aby020-181717?logo=github">
</a>

<a href="https://linkedin.com/in/abithomas-dev">
<img src="https://img.shields.io/badge/LinkedIn-Abi%20Thomas-0A66C2?logo=linkedin">
</a>

</p>

</div>

## ⭐ Support

If you found this project helpful, please consider giving it a ⭐ on GitHub.

Your support motivates me to continue building and improving high-quality open-source software.

If you have suggestions, feedback, or would like to collaborate, feel free to connect with me on GitHub or LinkedIn.