# PeoplePay360 — HR & Payroll

An integrated HR and payroll platform where the records feed each other. The employee is the hub; contracts and working schedules supply payroll context; attendance and time off capture daily activity; salary rules define computation; a payrun turns eligible employees into validated payslips that print as PDF and get emailed; and a dashboard aggregates every module live.

Built in 24 hours for the Odoo hackathon, against the **PeoplePay360: HR & Payroll** problem statement.

**[Live demo](https://peoplepay360-black.vercel.app/login)** · sign in with `admin@oxp.com` / `demo1234`, or click any demo row on the login screen.

![Payroll dashboard](screenshots/02-dashboard.jpg)

---

## What makes it more than CRUD

Three claims, each provable in the running app and each backed by a re-runnable script.

**1. Salary rules drive the payslip.** Every amount comes from evaluating a `SalaryRule` row. Open Payroll → Rules → House Rent Allowance, change 20% to 25%, recompute the payrun, and the line moves from ₹8,500 to ₹10,625 with net following. No code is touched and nothing restarts.

**2. Payroll uses the contract in force for the period**, not the newest one. The same employee computes basic pay of ₹39,000 for November 2025 and ₹42,500 for February 2026, because two different contracts cover those months.

**3. The dashboard reads live data.** No hardcoded series, no mock arrays. Every figure is a database aggregate that re-rolls when you change the period, department or employee type.

The formula field is user-editable configuration, so it is evaluated by a hand-written tokenizer and recursive-descent parser rather than by JavaScript. `eval`, `new Function` and `vm` are banned in this codebase: running a user's formula as code would be remote code execution. Parsing it also means an unknown identifier fails loudly, naming the rule, instead of silently becoming zero. All arithmetic runs on decimals, never floats.

---

## Screens

### Sign in

Split screen: an ink panel that draws a payslip and stamps it paid, and the form. The illustration uses no numerals at all, because an unauthenticated page should show neither real figures nor invented ones. Five demo accounts are one click away.

![Login](screenshots/01-login.jpg)

### Payroll dashboard

Twelve live aggregates: net salary with a six-month trend, payslip status, attendance health, the net composition band, salary by department, alerts, department and time-off overviews, and a row of raw record counts as proof that nothing is hardcoded. Filters live in the URL, so a filtered view is shareable and survives a refresh.

<details>
<summary><b>Dark mode</b> — one token set, switched by colour scheme, with a circular reveal from the toggle</summary>

![Dashboard in dark mode](screenshots/03-dashboard-dark.jpg)

</details>

### Employees

The hub record. Kanban and list views, and smart buttons whose counts are live queries linking to each list pre-filtered.

![Employees](screenshots/04-employees.jpg)
![Employee record](screenshots/05-employee-record.jpg)

### Contracts and working schedules

Contracts are period-scoped and history is preserved. Attempting a second running contract that overlaps an existing one is rejected, naming the conflict. Weekly hours are derived from the day pattern, never typed.

![Contracts](screenshots/06-contracts.jpg)
![Working schedule](screenshots/16-working-schedule.jpg)

### Attendance

Check in and check out, with worked hours and overtime derived from the employee's schedule. A missing check-out is flagged as an exception rather than guessed. Only HR can edit a record, and every correction is attributed.

![Attendance](screenshots/07-attendance.jpg)

### Time off

Types carry the policy: the unit, whether an allocation is required, and the approval flow. Approving a request consumes its allocation; refusing releases the days back. The remaining balance is derived, never stored.

![Time off requests](screenshots/08-time-off-requests.jpg)
![Time off allocations](screenshots/09-time-off-allocations.jpg)

### Payruns

A two-step wizard that writes nothing until you press create, then compute, validate and mark paid. The stepper shows the state machine, and a blocking warning refuses validation outright, naming the employee.

![Payruns](screenshots/10-payruns.jpg)
![Payrun detail](screenshots/11-payrun-detail.jpg)

### Payslips

Every line traces to the rule that produced it, and hovering a line reveals its formula. The header names the contract and wage that were used. Print produces a PDF whose net matches the screen exactly.

![Payslip](screenshots/12-payslip.jpg)

### Salary structures and rules

Rules run in ascending sequence against a shared scope, which is what lets gross and net be plain formulas over earlier codes. Each rule is a fixed amount, a percentage of one of four bases, or a formula, with an optional condition.

![Salary rules](screenshots/13-salary-rules.jpg)
![Salary rule detail](screenshots/14-salary-rule-detail.jpg)

### Salary simulator — beyond the brief

Answers "what would this cost?" without touching payroll. It has no engine of its own: it calls the same context builder and compute function a real payrun calls. With no overrides every line reads *no change*, reproducing the stored payslip to the paisa. That is the point, because once the baseline is provably identical, a number that does move can be trusted. Nothing is written, and a script fingerprints the whole payroll dataset before and after seven simulations to prove it.

![Simulator](screenshots/15-simulator.jpg)

### User management and self service

Admins create accounts, link them to an employee and assign roles; nobody can change their own. An employee signs in to a different application entirely: their own profile, their own attendance, their leave, their payslips.

![Users](screenshots/17-users.jpg)
![Employee self service](screenshots/18-employee-self-service.jpg)
![My payslips](screenshots/19-my-payslips.jpg)

---

## Roles

Five roles, enforced on the server at every mutation and query. Hiding a navigation item is never the security boundary, and employee-scoped queries are narrowed in the `where` clause rather than filtered afterwards.

| Role | Scope |
|---|---|
| Employee | Own record, attendance, leave and payslips; can log attendance and request leave |
| HR Manager | Full control of employees, contracts, schedules, attendance and time off, including approvals; no payroll |
| HR Payroll User | The above plus payruns and payslips; read-only salary configuration |
| HR Payroll Manager | Adds full control of payruns, payslips, structures and rules |
| Admin | Everything, plus user management and role assignment |

---

## Architecture

| | |
|---|---|
| Framework | Next.js 16 App Router, React 19, TypeScript strict |
| Data | Prisma 6, PostgreSQL 16, 18 models |
| Auth | Auth.js v5, credentials with a JWT session, bcrypt |
| UI | Tailwind CSS v4, hand-written primitives, Recharts |
| Output | React PDF for payslips, Nodemailer for delivery |
| Scale | ~23,500 lines of TypeScript, 40 pages, 35 server actions |

Pages are Server Components that query the database directly and stream HTML; only islands such as charts, filters and forms run in the browser. Mutations are server actions, not API routes: there are exactly two route handlers in the whole app, one for auth and one to stream a PDF. Each action guards, validates with zod, delegates to a domain module, revalidates, and returns a typed result instead of throwing across the boundary. Domain logic lives in a library layer free of auth and revalidation, which is why the verification scripts can exercise it directly.

Derived values are never accepted from the client. Worked hours, overtime, leave duration and taken balance are absent from the validation schemas entirely, so a tampered payload has no field to tamper with.

### Performance

The database is remote, so page time is round trips rather than rows. A later pass cut the dashboard from about 40 statements in four serial waves to 27 in one, by scoping through relations instead of fetching identifiers first and by sharing repeated figures within a request. Sign-in used to render the dashboard twice, and now navigates once. The page streams as four sections behind skeletons whose heights were measured against the real cards, so nothing shifts as data lands.

| Measured, production build, warm | |
|---|---|
| Header visible | 0.24 s |
| Whole dashboard complete | 0.55 s |

---

## Running it locally

```bash
cd peoplepay360
cp .env.example .env          # then set AUTH_SECRET
docker compose up -d          # Postgres on :5433, MailHog on :1025, UI on :8025
npm install
npx prisma migrate deploy && npx prisma db seed
npm run dev                   # http://localhost:3000
```

Postgres is mapped to host port 5433, not 5432, so it does not clash with a native install.

### Demo accounts

All five share the password `demo1234`.

| Email | Role | Lands on |
|---|---|---|
| `admin@oxp.com` | Admin | Payroll dashboard |
| `nisha@oxp.com` | HR Payroll Manager | Payroll dashboard |
| `rohan@oxp.com` | HR Payroll User | Payroll dashboard |
| `sara@oxp.com` | HR Manager | Employees |
| `aarav@oxp.com` | Employee | Own profile |

### What the seed contains

One company, 22 employees, 23 contracts, 2,856 attendance rows, 4 time-off types, 24 allocations, 15 requests, 3 salary structures with 24 rules, 5 paid payruns from April to August 2026, 110 payslips and 10 warnings. It is idempotent, and it creates those payruns by calling the real payroll functions rather than faking them.

Two gaps are deliberate. September 2026 has no payrun, so a demo creates it live. Two employees have no bank details, so they raise genuine payroll warnings.

---

## Verification

There is no test framework. Instead there are twelve re-runnable scripts that prove the business rules rather than asserting them.

```bash
npx tsx prisma/check-evaluator.ts         # formula interpreter, no database needed
npx tsx prisma/check-contracts.ts         # overlap guard, period-applicable resolution
npx tsx prisma/check-attendance.ts        # worked hours, overtime, classification
npx tsx prisma/check-timeoff.ts           # allocation to request to balance, ledger integrity
npx tsx prisma/check-engine.ts            # rules genuinely drive payslips
npx tsx prisma/check-scenario-a.ts        # wizard, compute, validate, paid
npx tsx prisma/check-warnings.ts          # seven warning codes and the blocking gate
npx tsx prisma/check-dashboard.ts         # live aggregates respond to filters
npx tsx prisma/check-simulator.ts         # what-if fidelity, and that it writes nothing
npx tsx prisma/check-payslip-delivery.ts  # PDF and email (needs the dev server)
npx tsx prisma/check-pagination.ts        # every row reachable
npx tsx prisma/check-smoke.ts             # 42 routes across 5 roles, 210 checks
```

The delivery script decompresses the PDF's character maps to prove the rupee and minus glyphs really embedded, because the built-in PDF fonts cannot encode either and would silently emit the wrong glyph. That is why Noto Sans ships in `public/fonts/`.

---

## Repository layout

```
peoplepay360/
├── prisma/            schema, seed, and the twelve verification scripts
├── public/fonts/      Noto Sans, for the rupee sign in generated PDFs
└── src/
    ├── app/           40 pages, 2 route handlers, grouped by (app) and (auth)
    ├── actions/       35 server actions, the permission boundary
    ├── components/    UI primitives, motion, and one folder per feature
    ├── lib/           payroll engine, time off, attendance, validation, PDF, mail
    └── styles/        seven package stylesheets over one token layer
screenshots/           the images in this README
```

---

A click-by-click walkthrough of both demo scenarios, employee to payslip and allocation to balance, lives in [`peoplepay360/README.md`](peoplepay360/README.md).

---

## Roadmap

- Statutory tax packs per jurisdiction, so rules ship preloaded rather than hand-configured
- Bank transfer file export from a paid payrun
- Payroll journal entries pushed to accounting
- Employee self-service mobile app
- Biometric and device attendance ingestion
- Multi-currency and true multi-company isolation
- Approval delegation chains for leave and payroll
- An audit-log viewer over the existing edit trails
