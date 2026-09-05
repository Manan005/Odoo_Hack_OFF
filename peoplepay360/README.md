# PeoplePay360 — HR & Payroll

An integrated HR and payroll platform where the records feed each other: the
Employee is the hub, Contracts and Working Schedules supply payroll context,
Attendance and Time Off capture daily activity, Salary Rules define computation,
and Payruns turn eligible employees into validated payslips that print as PDF
and get emailed.

Built for the Odoo hackathon against the **PeoplePay360: HR & Payroll** problem
statement.

---

## Setup

```bash
cd peoplepay360
cp .env.example .env          # then set AUTH_SECRET
docker compose up -d          # Postgres on :5433, MailHog on :1025 / UI :8025
npm install
npx prisma migrate deploy && npx prisma db seed
npm run dev                   # http://localhost:3000
```

> Postgres is mapped to host port **5433**, not 5432, so it does not clash with
> a natively installed Postgres.

## Demo accounts

Password for all five: `demo1234`

| Email | Role | Lands on |
|---|---|---|
| `admin@oxp.com` | Admin | Payroll Dashboard |
| `nisha@oxp.com` | HR Payroll Manager | Payroll Dashboard |
| `rohan@oxp.com` | HR Payroll User | Payroll Dashboard |
| `sara@oxp.com` | HR Manager | Employees |
| `aarav@oxp.com` | Employee | Own profile |

## What the seed contains

22 employees · 23 contracts · 2,856 attendance rows · 4 time-off types ·
24 allocations · 15 requests · 3 salary structures with 24 rules ·
5 paid payruns (Apr–Aug 2026) · 110 payslips · 10 payroll warnings

Two things are deliberate:

- **September 2026 has no payrun.** The demo creates it live.
- **Two employees have no bank details.** They raise real payroll warnings.

---

## Demo scenario A — employee to payslip

Sign in as `nisha@oxp.com`.

1. **Employees → Aarav Mehta.** Smart buttons show live counts for Contracts,
   Attendance, Time Off and Allocations.
2. **Contracts (2).** Two contracts: `CON/2025/0018` (Jul–Dec 2025, ₹78,000,
   expired) and `CON/2026/0042` (Jan 2026 onward, ₹85,000, running).
3. Try adding a third running contract overlapping January 2026 — it is
   rejected, naming the conflict.
4. **Payroll → Payruns → NEW.** Step 1: Regular Salary, period September 2026.
   *Continue* — nothing is written yet. Step 2: tick a few employees, including
   one without bank details. **Create Payrun** — only now does the record exist.
5. **COMPUTE.** Open Aarav's payslip: every line traces to a salary rule, and
   the header names contract `CON/2026/0042` at ₹85,000.
6. The warnings panel flags the missing bank details. **VALIDATE**, then
   **MARK PAID**.
7. **PRINT PAYSLIP** for the PDF. **SEND PAYSLIPS** to email them — check
   http://localhost:8025.
8. **Payroll → Dashboard.** The new payrun appears in the totals and the trend.

**The point to make:** open `Payroll → Rules → House Rent Allowance`, change 20%
to 25%, recompute the payrun, and the payslip changes. No code was touched.

## Demo scenario B — allocation to request to balance

Sign in as `sara@oxp.com`.

1. **Time Off → Time Off Types.** *Paid Time Off* requires an allocation;
   *Sick Leave* does not.
2. **Allocations.** Aarav holds 20 days PTO, some already taken.
3. **Requests → NEW.** Ask for more days than remain — refused, with the actual
   remaining figure in the message.
4. Request 3 days and **Approve**. The allocation's Taken rises by 3 and
   Remaining falls by 3.
5. **Refuse** it — the balance returns exactly.
6. Raise a Sick Leave request with no allocation — it approves cleanly.

---

## Stack

Next.js 16 (App Router, Server Actions) · TypeScript · Prisma 6 · PostgreSQL 16 ·
Tailwind v4 · Auth.js v5 · Recharts · `@react-pdf/renderer` · Nodemailer

## Verification

Nine re-runnable scripts prove the business rules rather than asserting them:

```bash
npx tsx prisma/check-evaluator.ts         # 46 interpreter tests, no DB needed
npx tsx prisma/check-contracts.ts         # period-applicable contract, overlap guard
npx tsx prisma/check-attendance.ts        # worked hours, overtime, classification
npx tsx prisma/check-timeoff.ts           # scenario B, ledger integrity
npx tsx prisma/check-engine.ts            # rules genuinely drive payslips
npx tsx prisma/check-scenario-a.ts        # wizard to compute to validate to paid
npx tsx prisma/check-warnings.ts          # 7 warning codes, blocking gate
npx tsx prisma/check-dashboard.ts         # live aggregates respond to filters
npx tsx prisma/check-payslip-delivery.ts  # PDF + email (needs the dev server up)
```

`check-payslip-delivery.ts` also inflates the PDF's `/ToUnicode` maps to prove
the `₹` and `−` glyphs really made it into the file — the built-in PDF fonts
cannot encode either, so the payslip embeds Noto Sans from `public/fonts/`
(SIL Open Font License, see `public/fonts/OFL.txt`).

### The three claims that matter

**Salary rules drive the payslip.** Changing HRA from 20% to 25% moves the line
from ₹8,500 to ₹10,625 and Net from ₹51,111.14 to ₹53,023.64, with no code
change.

**Payroll uses the period-applicable contract.** The same employee computes
Basic ₹39,000 for November 2025 and ₹42,500 for February 2026, because the
contracts differ — not because the newest one was picked.

**The dashboard reads live data.** August 2026 totals ₹10,83,881, matching the
raw payslip sum exactly. Filtering to Finance narrows it to ₹1,83,838 across
four payslips, and approving a five-day leave request moves the Approved Time
Off card from 3 to 8.

---

## Roadmap

- Statutory tax packs per jurisdiction, so rules ship preloaded rather than
  hand-configured
- Bank transfer file export (NEFT/ACH) from a paid payrun
- Payroll journal entries pushed to accounting
- Employee self-service mobile app
- Biometric and device attendance ingestion
- Multi-currency and true multi-company isolation
- Approval delegation chains for leave and payroll
- An audit-log viewer over the existing edit trails
