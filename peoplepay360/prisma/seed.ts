/**
 * Idempotent seed — `npx prisma db seed` twice yields the same database.
 * Every record uses a stable natural key so upserts match on re-run.
 *
 * P0 scope: Company, Departments, Job Positions, Working Schedules, Employees, Users.
 * Later phases extend this file (contracts, attendance, time off, payroll).
 */
import {
  ApprovalMode,
  AttendanceStatus,
  CalendarType,
  ComputationType,
  ContractStatus,
  EmployeeType,
  Gender,
  PercentageBase,
  PrismaClient,
  RequestStatus,
  Role,
  RuleCategory,
  TimeOffUnit,
  Weekday,
} from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

const COMPANY_NAME = "OXP Pvt Ltd"
const DEMO_PASSWORD = "demo1234"

/**
 * Calendar dates must be stored as UTC midnight. `new Date(2026, 0, 1)` is
 * *local* midnight, which in IST (UTC+5:30) persists as 2025-12-31T18:30Z —
 * every date silently shifts back a day and payroll period boundaries break.
 */
const utc = (year: number, month: number, day: number) =>
  new Date(Date.UTC(year, month, day))

// ─────────────────────────── Schedule patterns ───────────────────────────

type LineSpec = { day: Weekday; startTime: string; endTime: string; breakHours: number }

const WEEK = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
] as const

const lines = (
  days: readonly Weekday[],
  startTime: string,
  endTime: string,
  breakHours: number,
): LineSpec[] => days.map((day) => ({ day, startTime, endTime, breakHours }))

/** BR-S1: hours are derived from the pattern, never typed in. */
const lineHours = (l: LineSpec): number => {
  const toH = (s: string) => {
    const [h, m] = s.split(":").map(Number)
    return h + m / 60
  }
  return Number((toH(l.endTime) - toH(l.startTime) - l.breakHours).toFixed(2))
}

const SCHEDULES: Array<{
  name: string
  calendarType: CalendarType
  active: boolean
  lines: LineSpec[]
}> = [
  {
    name: "40 Hours / Week",
    calendarType: CalendarType.FIXED,
    active: true,
    lines: lines(WEEK, "09:00", "18:00", 1),
  },
  {
    name: "Night Shift",
    calendarType: CalendarType.FIXED,
    active: true,
    lines: lines(WEEK, "22:00", "23:59", 0).map((l, i) => ({
      ...l,
      startTime: "13:00",
      endTime: "22:00",
      breakHours: 1,
      day: WEEK[i],
    })),
  },
  {
    name: "Retail Weekend",
    calendarType: CalendarType.FIXED,
    active: true,
    lines: lines(
      [Weekday.WEDNESDAY, Weekday.THURSDAY, Weekday.FRIDAY, Weekday.SATURDAY, Weekday.SUNDAY],
      "10:00",
      "19:00",
      1,
    ),
  },
  {
    name: "Flexible Hybrid",
    calendarType: CalendarType.VARIABLE,
    active: true,
    lines: lines(WEEK, "09:30", "18:00", 1),
  },
  {
    name: "Part-time 20h",
    calendarType: CalendarType.FIXED,
    active: false,
    lines: lines([Weekday.MONDAY, Weekday.TUESDAY, Weekday.WEDNESDAY, Weekday.THURSDAY], "09:00", "14:00", 0),
  },
]

// ───────────────────────────── Master data ─────────────────────────────

const DEPARTMENTS = ["Finance", "HR", "Engineering", "Sales", "Support"] as const

const POSITIONS = [
  "Payroll Specialist",
  "HR Officer",
  "Developer",
  "Recruiter",
  "Accountant",
  "Sales Executive",
  "Support Engineer",
  "Engineering Manager",
] as const

type EmployeeSpec = {
  code: string
  firstName: string
  lastName: string
  department: (typeof DEPARTMENTS)[number]
  position: (typeof POSITIONS)[number]
  type: EmployeeType
  schedule: string
  /** Deliberately absent on two employees — drives MISSING_BANK_DETAILS warnings. */
  bank: boolean
  managerCode?: string
}

const EMPLOYEES: EmployeeSpec[] = [
  // Wireframe-named employees come first — the demo script uses these.
  { code: "EMP/0001", firstName: "Aarav", lastName: "Mehta", department: "Finance", position: "Payroll Specialist", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0002" },
  { code: "EMP/0002", firstName: "Sara", lastName: "Khan", department: "HR", position: "HR Officer", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true },
  { code: "EMP/0003", firstName: "John", lastName: "Dsouza", department: "Engineering", position: "Developer", type: EmployeeType.FULL_TIME, schedule: "Flexible Hybrid", bank: true, managerCode: "EMP/0008" },
  { code: "EMP/0004", firstName: "Neha", lastName: "Patel", department: "HR", position: "Recruiter", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0002" },
  { code: "EMP/0005", firstName: "Nisha", lastName: "Rao", department: "Finance", position: "Accountant", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true },
  { code: "EMP/0006", firstName: "Rohan", lastName: "Patel", department: "Finance", position: "Payroll Specialist", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0005" },
  { code: "EMP/0007", firstName: "Maya", lastName: "Shah", department: "HR", position: "HR Officer", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0002" },
  { code: "EMP/0008", firstName: "Vikram", lastName: "Iyer", department: "Engineering", position: "Engineering Manager", type: EmployeeType.FULL_TIME, schedule: "Flexible Hybrid", bank: true },
  { code: "EMP/0009", firstName: "Priya", lastName: "Nair", department: "Engineering", position: "Developer", type: EmployeeType.FULL_TIME, schedule: "Flexible Hybrid", bank: true, managerCode: "EMP/0008" },
  { code: "EMP/0010", firstName: "Arjun", lastName: "Reddy", department: "Engineering", position: "Developer", type: EmployeeType.FULL_TIME, schedule: "Flexible Hybrid", bank: false, managerCode: "EMP/0008" },
  { code: "EMP/0011", firstName: "Kavya", lastName: "Menon", department: "Sales", position: "Sales Executive", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0012" },
  { code: "EMP/0012", firstName: "Rahul", lastName: "Verma", department: "Sales", position: "Sales Executive", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true },
  { code: "EMP/0013", firstName: "Ananya", lastName: "Bose", department: "Sales", position: "Sales Executive", type: EmployeeType.FULL_TIME, schedule: "Retail Weekend", bank: true, managerCode: "EMP/0012" },
  { code: "EMP/0014", firstName: "Karthik", lastName: "Subramanian", department: "Support", position: "Support Engineer", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0015" },
  { code: "EMP/0015", firstName: "Divya", lastName: "Kulkarni", department: "Support", position: "Support Engineer", type: EmployeeType.FULL_TIME, schedule: "40 Hours / Week", bank: true },
  { code: "EMP/0016", firstName: "Aditya", lastName: "Joshi", department: "Support", position: "Support Engineer", type: EmployeeType.FULL_TIME, schedule: "Retail Weekend", bank: false, managerCode: "EMP/0015" },
  { code: "EMP/0017", firstName: "Sneha", lastName: "Pillai", department: "Finance", position: "Accountant", type: EmployeeType.PART_TIME, schedule: "Part-time 20h", bank: true, managerCode: "EMP/0005" },
  { code: "EMP/0018", firstName: "Manish", lastName: "Gupta", department: "Engineering", position: "Developer", type: EmployeeType.CONTRACT, schedule: "Flexible Hybrid", bank: true, managerCode: "EMP/0008" },
  { code: "EMP/0019", firstName: "Ishita", lastName: "Chatterjee", department: "Sales", position: "Sales Executive", type: EmployeeType.CONTRACT, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0012" },
  { code: "EMP/0020", firstName: "Tanvi", lastName: "Desai", department: "Engineering", position: "Developer", type: EmployeeType.INTERN, schedule: "Flexible Hybrid", bank: true, managerCode: "EMP/0008" },
  { code: "EMP/0021", firstName: "Yash", lastName: "Malhotra", department: "Support", position: "Support Engineer", type: EmployeeType.INTERN, schedule: "40 Hours / Week", bank: true, managerCode: "EMP/0015" },
  { code: "EMP/0022", firstName: "Ritu", lastName: "Saxena", department: "HR", position: "Recruiter", type: EmployeeType.FREELANCE, schedule: "Flexible Hybrid", bank: true, managerCode: "EMP/0002" },
]

const USERS: Array<{ employeeCode: string; email: string; roles: Role[] }> = [
  { employeeCode: "EMP/0001", email: "aarav@oxp.com", roles: [Role.EMPLOYEE] },
  { employeeCode: "EMP/0002", email: "sara@oxp.com", roles: [Role.HR_MANAGER] },
  { employeeCode: "EMP/0006", email: "rohan@oxp.com", roles: [Role.HR_PAYROLL_USER] },
  { employeeCode: "EMP/0005", email: "nisha@oxp.com", roles: [Role.HR_PAYROLL_MANAGER] },
  { employeeCode: "EMP/0007", email: "admin@oxp.com", roles: [Role.ADMIN] },
]

const AVATAR_COLORS = ["indigo", "teal", "amber", "magenta", "green"]

const emailFor = (e: EmployeeSpec) => `${e.firstName.toLowerCase()}@oxp.com`

// ───────────────────────────────── Seed ─────────────────────────────────

async function main() {
  console.log("Seeding PeoplePay360…")

  const company = await db.company.upsert({
    where: { id: "seed-company" },
    update: { name: COMPANY_NAME, currency: "INR" },
    create: {
      id: "seed-company",
      name: COMPANY_NAME,
      currency: "INR",
      address: "Level 7, Prabhadevi, Mumbai 400025",
    },
  })
  console.log(`  company: ${company.name}`)

  const departments = new Map<string, string>()
  for (const name of DEPARTMENTS) {
    const d = await db.department.upsert({
      where: { companyId_name: { companyId: company.id, name } },
      update: {},
      create: { name, companyId: company.id },
    })
    departments.set(name, d.id)
  }
  console.log(`  departments: ${departments.size}`)

  const positions = new Map<string, string>()
  for (const name of POSITIONS) {
    const p = await db.jobPosition.upsert({ where: { name }, update: {}, create: { name } })
    positions.set(name, p.id)
  }
  console.log(`  job positions: ${positions.size}`)

  const schedules = new Map<string, string>()
  for (const spec of SCHEDULES) {
    const hoursPerWeek = spec.lines.reduce((sum, l) => sum + lineHours(l), 0)
    const s = await db.workingSchedule.upsert({
      where: { companyId_name: { companyId: company.id, name: spec.name } },
      update: {
        calendarType: spec.calendarType,
        active: spec.active,
        daysPerWeek: spec.lines.length,
        hoursPerWeek,
      },
      create: {
        name: spec.name,
        companyId: company.id,
        calendarType: spec.calendarType,
        active: spec.active,
        daysPerWeek: spec.lines.length,
        hoursPerWeek,
      },
    })
    // Replace lines wholesale so re-seeding never accumulates duplicates.
    await db.scheduleLine.deleteMany({ where: { scheduleId: s.id } })
    await db.scheduleLine.createMany({
      data: spec.lines.map((l) => ({
        scheduleId: s.id,
        day: l.day,
        startTime: l.startTime,
        endTime: l.endTime,
        breakHours: l.breakHours,
        hours: lineHours(l),
      })),
    })
    schedules.set(spec.name, s.id)
    console.log(`  schedule: ${spec.name} — ${spec.lines.length}d / ${hoursPerWeek}h`)
  }

  // Pass 1: create employees without managers (manager may not exist yet).
  const employeeIds = new Map<string, string>()
  for (const [i, spec] of EMPLOYEES.entries()) {
    const e = await db.employee.upsert({
      where: { employeeCode: spec.code },
      update: {},
      create: {
        employeeCode: spec.code,
        firstName: spec.firstName,
        lastName: spec.lastName,
        workEmail: emailFor(spec),
        workPhone: `+91 98${String(76543210 + i).padStart(8, "0")}`,
        employeeType: spec.type,
        workLocation: "Mumbai",
        joiningDate: utc(2024, i % 12, 1 + (i % 27)),
        active: true,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        personalEmail: `${spec.firstName.toLowerCase()}.${spec.lastName.toLowerCase()}@gmail.com`,
        dateOfBirth: utc(1990 + (i % 12), i % 12, 1 + (i % 27)),
        gender: i % 2 === 0 ? Gender.MALE : Gender.FEMALE,
        address: `${100 + i}, Sector ${1 + (i % 9)}, Mumbai`,
        emergencyContactName: "Emergency Contact",
        emergencyContactPhone: `+91 99${String(11223344 + i).padStart(8, "0")}`,
        // Two employees ship without bank details on purpose (payroll warnings).
        bankAccountNumber: spec.bank ? `5001${String(1000000 + i * 7919)}` : null,
        bankName: spec.bank ? "HDFC Bank" : null,
        bankIfsc: spec.bank ? "HDFC0001234" : null,
        companyId: company.id,
        departmentId: departments.get(spec.department)!,
        jobPositionId: positions.get(spec.position)!,
        workingScheduleId: schedules.get(spec.schedule)!,
      },
    })
    employeeIds.set(spec.code, e.id)
  }

  // Pass 2: wire managers now that every employee row exists.
  for (const spec of EMPLOYEES) {
    if (!spec.managerCode) continue
    await db.employee.update({
      where: { employeeCode: spec.code },
      data: { managerId: employeeIds.get(spec.managerCode)! },
    })
  }
  console.log(`  employees: ${employeeIds.size}`)

  // Department managers.
  const deptManagers: Array<[string, string]> = [
    ["Finance", "EMP/0005"],
    ["HR", "EMP/0002"],
    ["Engineering", "EMP/0008"],
    ["Sales", "EMP/0012"],
    ["Support", "EMP/0015"],
  ]
  for (const [dept, code] of deptManagers) {
    await db.department.update({
      where: { companyId_name: { companyId: company.id, name: dept } },
      data: { managerId: employeeIds.get(code)! },
    })
  }

  // ─────────────────────────── Contracts ───────────────────────────
  // Every active employee gets one open-ended RUNNING contract from Jan 2026.
  // Aarav additionally carries an EXPIRED 2025 contract at a lower wage — that
  // pair is what proves BR-C2 (period-applicable resolution) in the demo.
  const WAGE_BY_POSITION: Record<string, number> = {
    "Engineering Manager": 145000,
    Developer: 95000,
    "Payroll Specialist": 85000,
    Accountant: 78000,
    "HR Officer": 95000,
    Recruiter: 72000,
    "Sales Executive": 88000,
    "Support Engineer": 68000,
  }

  const expectedRefs: string[] = []
  for (const [i, spec] of EMPLOYEES.entries()) {
    const employeeId = employeeIds.get(spec.code)!
    const wage = WAGE_BY_POSITION[spec.position] ?? 70000
    // Aarav's reference is pinned to the one the wireframe shows, so the demo
    // script and the mockup line up.
    const reference =
      spec.code === "EMP/0001"
        ? "CON/2026/0042"
        : `CON/2026/${String(i + 1).padStart(4, "0")}`
    expectedRefs.push(reference)

    await db.contract.upsert({
      where: { reference },
      // startDate/endDate are re-asserted so an existing row created before the
      // UTC fix is corrected rather than left drifted.
      update: {
        employeeId,
        wage,
        status: ContractStatus.RUNNING,
        startDate: utc(2026, 0, 1),
        endDate: null,
      },
      create: {
        reference,
        employeeId,
        startDate: utc(2026, 0, 1),
        endDate: null,
        wage,
        status: ContractStatus.RUNNING,
        departmentId: departments.get(spec.department)!,
        jobPositionId: positions.get(spec.position)!,
        workingScheduleId: schedules.get(spec.schedule)!,
        notes: "Standard employment contract.",
      },
    })
  }

  // Aarav's prior contract — Jul–Dec 2025 at a lower wage. This pair is what
  // proves BR-C2: a Nov-2025 payrun must pick this, not the 2026 contract.
  expectedRefs.push("CON/2025/0018")
  await db.contract.upsert({
    where: { reference: "CON/2025/0018" },
    update: { startDate: utc(2025, 6, 1), endDate: utc(2025, 11, 31), wage: 78000 },
    create: {
      reference: "CON/2025/0018",
      employeeId: employeeIds.get("EMP/0001")!,
      startDate: utc(2025, 6, 1),
      endDate: utc(2025, 11, 31),
      wage: 78000,
      status: ContractStatus.RUNNING,
      departmentId: departments.get("Finance")!,
      jobPositionId: positions.get("Payroll Specialist")!,
      workingScheduleId: schedules.get("40 Hours / Week")!,
      notes: "Prior contract — superseded from 01-Jan-2026.",
    },
  })

  // Self-healing: drop seeded contracts that are no longer expected, so a
  // renamed reference cannot leave an orphan behind and violate BR-C1.
  const removed = await db.contract.deleteMany({
    where: { reference: { startsWith: "CON/" }, NOT: { reference: { in: expectedRefs } } },
  })
  if (removed.count > 0) console.log(`  removed ${removed.count} stale contract(s)`)
  console.log(`  contracts: ${expectedRefs.length}`)

  // ────────────────────────── Attendance ──────────────────────────
  // Apr–Sep 2026 across every employee, carrying the exception mix the P8
  // dashboard reports on: missing check-outs, manual edits, late, absent and
  // overtime. Deterministic — a seeded PRNG keeps re-runs identical.
  let rngState = 20260905
  const rand = () => {
    // Mulberry32 — small, deterministic, good enough for demo data.
    rngState = (rngState + 0x6d2b79f5) | 0
    let t = rngState
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  const existingAttendance = await db.attendance.count()
  if (existingAttendance > 0) {
    console.log(`  attendance: ${existingAttendance} rows already present — skipping`)
  } else {
    const scheduleLines = await db.scheduleLine.findMany({
      select: { scheduleId: true, day: true, startTime: true, endTime: true, hours: true },
    })
    const linesBySchedule = new Map<string, typeof scheduleLines>()
    for (const l of scheduleLines) {
      linesBySchedule.set(l.scheduleId, [...(linesBySchedule.get(l.scheduleId) ?? []), l])
    }

    const WEEKDAY_BY_INDEX: Weekday[] = [
      Weekday.SUNDAY,
      Weekday.MONDAY,
      Weekday.TUESDAY,
      Weekday.WEDNESDAY,
      Weekday.THURSDAY,
      Weekday.FRIDAY,
      Weekday.SATURDAY,
    ]

    const seededEmployees = await db.employee.findMany({
      select: { id: true, workingScheduleId: true },
    })

    type AttendanceRow = {
      employeeId: string
      checkIn: Date
      checkOut: Date | null
      workedHours: number
      overtime: number
      status: AttendanceStatus
      manuallyEdited: boolean
      notes: string | null
    }
    const rows: AttendanceRow[] = []

    // Apr 1 2026 → Sep 30 2026.
    const from = utc(2026, 3, 1)
    const to = utc(2026, 8, 30)

    let missingCheckOuts = 0
    let manualEdits = 0

    for (const emp of seededEmployees) {
      const lines = emp.workingScheduleId
        ? (linesBySchedule.get(emp.workingScheduleId) ?? [])
        : []
      if (lines.length === 0) continue

      for (let d = new Date(from); d <= to; d.setUTCDate(d.getUTCDate() + 1)) {
        const line = lines.find((l) => l.day === WEEKDAY_BY_INDEX[d.getUTCDay()])
        if (!line) continue

        const roll = rand()
        const [sh, sm] = line.startTime.split(":").map(Number)
        const [eh, em] = line.endTime.split(":").map(Number)
        // Compare like with like: workedHours is a raw clock span, so the
        // baseline is the scheduled span (break included), not the net hours.
        const expectedSpan = Number((eh + em / 60 - (sh + sm / 60)).toFixed(2))

        // ~4% absent — no clock values at all.
        if (roll < 0.04) {
          rows.push({
            employeeId: emp.id,
            checkIn: new Date(
              Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sh, sm),
            ),
            checkOut: null,
            workedHours: 0,
            overtime: 0,
            status: AttendanceStatus.ABSENT,
            manuallyEdited: false,
            notes: null,
          })
          continue
        }

        // ~8% late — arrive 16–75 minutes after the scheduled start.
        const isLate = roll < 0.12
        const lateBy = isLate ? 16 + Math.floor(rand() * 60) : Math.floor(rand() * 10)
        const checkIn = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), sh, sm + lateBy),
        )

        // Most days land near the scheduled span; ~12% run into overtime.
        const overtimeToday = rand() < 0.12 ? 0.5 + rand() * 2 : 0
        const workedHours = Number((expectedSpan + overtimeToday - rand() * 0.2).toFixed(2))
        // checkOut is derived from workedHours so the stored value and the
        // clock span always agree — the gate script asserts exactly this.
        const checkOut = new Date(checkIn.getTime() + workedHours * 3_600_000)

        rows.push({
          employeeId: emp.id,
          checkIn,
          checkOut,
          workedHours,
          overtime: Number(Math.max(0, workedHours - expectedSpan).toFixed(2)),
          status: isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT,
          manuallyEdited: false,
          notes: null,
        })
      }
    }

    // Stamp the two exception classes on an exact, evenly spread set of rows
    // rather than leaving their counts to chance — the dashboard reports these
    // numbers, so the demo should show a known quantity.
    const TARGET_MISSING_CHECKOUTS = 5
    const TARGET_MANUAL_EDITS = 7
    const present = rows
      .map((r, i) => ({ r, i }))
      .filter(({ r }) => r.status !== AttendanceStatus.ABSENT && r.checkOut !== null)

    const stride = Math.floor(present.length / (TARGET_MISSING_CHECKOUTS + TARGET_MANUAL_EDITS + 2))
    let cursor = stride
    for (let n = 0; n < TARGET_MISSING_CHECKOUTS; n++, cursor += stride) {
      const row = present[cursor]?.r
      if (!row) break
      row.checkOut = null
      row.workedHours = 0
      row.overtime = 0
      row.notes = "Missing check-out."
      missingCheckOuts++
    }
    for (let n = 0; n < TARGET_MANUAL_EDITS; n++, cursor += stride) {
      const row = present[cursor]?.r
      if (!row) break
      row.manuallyEdited = true
      row.notes = "Corrected by HR after a device sync failure."
      manualEdits++
    }

    // createMany in batches — a single 2,600-row insert is fine but batching
    // keeps memory flat if the range is widened later.
    const BATCH = 500
    for (let i = 0; i < rows.length; i += BATCH) {
      await db.attendance.createMany({ data: rows.slice(i, i + BATCH) })
    }
    console.log(
      `  attendance: ${rows.length} rows (${missingCheckOuts} missing check-outs, ${manualEdits} manual edits)`,
    )
  }

  // ─────────────────────────── Time Off ───────────────────────────
  const TYPES = [
    {
      name: "Paid Time Off",
      unit: TimeOffUnit.DAYS,
      requiresAllocation: true,
      approvalMode: ApprovalMode.MANAGER,
      isPaid: true,
      displayColor: "blue",
      workEntryLabel: "Leave Work Entry",
      description: "Standard annual leave. Balance comes from approved allocations.",
    },
    {
      name: "Sick Leave",
      unit: TimeOffUnit.DAYS,
      requiresAllocation: false,
      approvalMode: ApprovalMode.MANAGER,
      isPaid: true,
      displayColor: "red",
      workEntryLabel: "Sick Work Entry",
      description: "Granted without an allocation; no balance is consumed.",
    },
    {
      name: "Comp Off",
      unit: TimeOffUnit.HOURS,
      requiresAllocation: true,
      approvalMode: ApprovalMode.HR_OFFICER,
      isPaid: true,
      displayColor: "green",
      workEntryLabel: "Comp Off Entry",
      description: "Earned against overtime worked. Requires an approved allocation.",
    },
    {
      name: "Unpaid Leave",
      unit: TimeOffUnit.DAYS,
      requiresAllocation: false,
      approvalMode: ApprovalMode.BOTH,
      isPaid: false,
      displayColor: "amber",
      workEntryLabel: "Unpaid Work Entry",
      description: "Drives the unpaid-leave deduction when payroll is computed.",
    },
  ]

  const typeIds = new Map<string, string>()
  for (const t of TYPES) {
    const row = await db.timeOffType.upsert({
      where: { companyId_name: { companyId: company.id, name: t.name } },
      update: {
        unit: t.unit,
        requiresAllocation: t.requiresAllocation,
        approvalMode: t.approvalMode,
        isPaid: t.isPaid,
        displayColor: t.displayColor,
        workEntryLabel: t.workEntryLabel,
        description: t.description,
        active: true,
      },
      create: { ...t, active: true, companyId: company.id },
    })
    typeIds.set(t.name, row.id)
  }
  console.log(`  time off types: ${typeIds.size}`)

  // Allocations are the grant side; requests consume them. Seeded together so
  // `taken` always equals the sum of the approved requests linked to it.
  const existingAllocations = await db.timeOffAllocation.count()
  if (existingAllocations > 0) {
    console.log(`  allocations: ${existingAllocations} already present — skipping`)
  } else {
    const ptoId = typeIds.get("Paid Time Off")!
    const compOffId = typeIds.get("Comp Off")!
    const sickId = typeIds.get("Sick Leave")!

    const allocationIds = new Map<string, string>()
    for (const spec of EMPLOYEES) {
      const employeeId = employeeIds.get(spec.code)!
      const alloc = await db.timeOffAllocation.create({
        data: {
          employeeId,
          typeId: ptoId,
          allocated: 20,
          taken: 0,
          status: RequestStatus.APPROVED,
          validityLabel: "2026 Annual Balance",
          description: "Annual leave balance granted at start of policy year.",
          approverId: employeeIds.get("EMP/0002")!,
        },
        select: { id: true },
      })
      allocationIds.set(spec.code, alloc.id)
    }

    // A couple of Comp Off allocations, one still awaiting approval so the
    // list shows the full lifecycle.
    await db.timeOffAllocation.create({
      data: {
        employeeId: employeeIds.get("EMP/0003")!,
        typeId: compOffId,
        allocated: 16,
        taken: 0,
        status: RequestStatus.APPROVED,
        validityLabel: "Overtime bank 2026",
        approverId: employeeIds.get("EMP/0002")!,
      },
    })
    await db.timeOffAllocation.create({
      data: {
        employeeId: employeeIds.get("EMP/0004")!,
        typeId: compOffId,
        allocated: 8,
        taken: 0,
        status: RequestStatus.TO_APPROVE,
        validityLabel: "Overtime bank 2026",
      },
    })
    console.log(`  allocations: ${allocationIds.size + 2}`)

    // Requests. Approved ones increment their allocation's `taken` so the
    // ledger balances exactly — the same invariant approveRequest maintains.
    type ReqSpec = {
      code: string
      typeId: string
      start: [number, number, number]
      end: [number, number, number]
      status: RequestStatus
      reason: string
      usesAllocation: boolean
    }

    const REQUESTS: ReqSpec[] = [
      { code: "EMP/0001", typeId: ptoId, start: [2026, 5, 15], end: [2026, 5, 19], status: RequestStatus.APPROVED, reason: "Family vacation", usesAllocation: true },
      { code: "EMP/0001", typeId: ptoId, start: [2026, 7, 10], end: [2026, 7, 12], status: RequestStatus.APPROVED, reason: "Personal", usesAllocation: true },
      { code: "EMP/0001", typeId: sickId, start: [2026, 6, 21], end: [2026, 6, 21], status: RequestStatus.APPROVED, reason: "Fever", usesAllocation: false },
      { code: "EMP/0002", typeId: ptoId, start: [2026, 6, 6], end: [2026, 6, 10], status: RequestStatus.APPROVED, reason: "Annual leave", usesAllocation: true },
      { code: "EMP/0003", typeId: ptoId, start: [2026, 4, 18], end: [2026, 4, 22], status: RequestStatus.APPROVED, reason: "Wedding", usesAllocation: true },
      { code: "EMP/0004", typeId: sickId, start: [2026, 7, 3], end: [2026, 7, 4], status: RequestStatus.APPROVED, reason: "Flu", usesAllocation: false },
      { code: "EMP/0005", typeId: ptoId, start: [2026, 8, 14], end: [2026, 8, 18], status: RequestStatus.TO_APPROVE, reason: "Trip", usesAllocation: true },
      { code: "EMP/0006", typeId: ptoId, start: [2026, 8, 21], end: [2026, 8, 22], status: RequestStatus.TO_APPROVE, reason: "Personal", usesAllocation: true },
      { code: "EMP/0008", typeId: ptoId, start: [2026, 5, 1], end: [2026, 5, 5], status: RequestStatus.APPROVED, reason: "Holiday", usesAllocation: true },
      { code: "EMP/0009", typeId: ptoId, start: [2026, 7, 20], end: [2026, 7, 24], status: RequestStatus.APPROVED, reason: "Travel", usesAllocation: true },
      { code: "EMP/0011", typeId: ptoId, start: [2026, 6, 15], end: [2026, 6, 17], status: RequestStatus.REFUSED, reason: "Clashes with quarter close", usesAllocation: true },
      { code: "EMP/0012", typeId: ptoId, start: [2026, 8, 3], end: [2026, 8, 7], status: RequestStatus.APPROVED, reason: "Family", usesAllocation: true },
      { code: "EMP/0014", typeId: sickId, start: [2026, 8, 11], end: [2026, 8, 11], status: RequestStatus.TO_APPROVE, reason: "Migraine", usesAllocation: false },
      { code: "EMP/0015", typeId: ptoId, start: [2026, 4, 6], end: [2026, 4, 8], status: RequestStatus.APPROVED, reason: "Personal", usesAllocation: true },
      { code: "EMP/0018", typeId: ptoId, start: [2026, 7, 27], end: [2026, 7, 31], status: RequestStatus.APPROVED, reason: "Vacation", usesAllocation: true },
    ]

    const scheduleDaysByEmployee = new Map<string, Weekday[]>()
    for (const spec of EMPLOYEES) {
      const found = SCHEDULES.find((s) => s.name === spec.schedule)
      scheduleDaysByEmployee.set(spec.code, found ? found.lines.map((l) => l.day) : [])
    }

    let approvedCount = 0
    for (const r of REQUESTS) {
      const employeeId = employeeIds.get(r.code)!
      const start = utc(...r.start)
      const end = utc(...r.end)
      const days = scheduleDaysByEmployee.get(r.code) ?? []

      // BR-T4 — count only scheduled working days.
      let duration = 0
      for (const d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
        const wd = [
          Weekday.SUNDAY,
          Weekday.MONDAY,
          Weekday.TUESDAY,
          Weekday.WEDNESDAY,
          Weekday.THURSDAY,
          Weekday.FRIDAY,
          Weekday.SATURDAY,
        ][d.getUTCDay()]
        if (days.includes(wd)) duration++
      }
      if (duration === 0) continue

      const allocationId = r.usesAllocation ? allocationIds.get(r.code) : null

      await db.timeOffRequest.create({
        data: {
          employeeId,
          typeId: r.typeId,
          startDate: start,
          endDate: end,
          duration,
          status: r.status,
          reason: r.reason,
          allocationId: allocationId ?? null,
          approverId:
            r.status === RequestStatus.TO_APPROVE ? null : employeeIds.get("EMP/0002")!,
        },
      })

      // BR-T2 — only an approved request consumes balance.
      if (r.status === RequestStatus.APPROVED && allocationId) {
        await db.timeOffAllocation.update({
          where: { id: allocationId },
          data: { taken: { increment: duration } },
        })
        approvedCount++
      }
    }
    console.log(`  time off requests: ${REQUESTS.length} (${approvedCount} consuming balance)`)
  }

  // ───────────────── Salary structures & rules ─────────────────
  // The reference set from PRD §M7.2. Sequence is the contract: GROSS runs
  // after every allowance, NET after every deduction, so both are plain
  // formulas over codes computed earlier.
  type RuleSpec = {
    name: string
    code: string
    category: RuleCategory
    sequence: number
    computationType: ComputationType
    amount?: string
    percentage?: string
    percentageBase?: PercentageBase
    baseRuleCode?: string
    formula?: string
    condition?: string
  }

  const REGULAR_RULES: RuleSpec[] = [
    { name: "Basic Salary", code: "BASIC", category: RuleCategory.BASIC, sequence: 1, computationType: ComputationType.PERCENTAGE, percentage: "50", percentageBase: PercentageBase.CONTRACT_WAGE },
    { name: "House Rent Allowance", code: "HRA", category: RuleCategory.ALLOWANCE, sequence: 10, computationType: ComputationType.PERCENTAGE, percentage: "20", percentageBase: PercentageBase.BASIC },
    { name: "Standard Allowance", code: "STD", category: RuleCategory.ALLOWANCE, sequence: 20, computationType: ComputationType.FIXED, amount: "3000" },
    { name: "Meal Allowance", code: "MEAL", category: RuleCategory.ALLOWANCE, sequence: 25, computationType: ComputationType.FIXED, amount: "2000" },
    { name: "Performance Bonus", code: "BONUS", category: RuleCategory.ALLOWANCE, sequence: 30, computationType: ComputationType.FORMULA, formula: "if(workedDays >= scheduledDays, BASIC * 0.10, 0)" },
    { name: "Overtime Pay", code: "OT", category: RuleCategory.ALLOWANCE, sequence: 40, computationType: ComputationType.FORMULA, formula: "round(overtimeHours * hourlyRate * 1.5, 2)" },
    { name: "Gross Salary", code: "GROSS", category: RuleCategory.GROSS, sequence: 50, computationType: ComputationType.FORMULA, formula: "BASIC + HRA + STD + MEAL + BONUS + OT" },
    { name: "Provident Fund", code: "PF", category: RuleCategory.DEDUCTION, sequence: 60, computationType: ComputationType.PERCENTAGE, percentage: "12", percentageBase: PercentageBase.BASIC },
    { name: "Professional Tax", code: "PT", category: RuleCategory.DEDUCTION, sequence: 65, computationType: ComputationType.FIXED, amount: "200" },
    { name: "Unpaid Leave Deduction", code: "LWP", category: RuleCategory.DEDUCTION, sequence: 70, computationType: ComputationType.FORMULA, formula: "round(unpaidLeaveDays * perDayRate, 2)" },
    { name: "Income Tax (TDS)", code: "TDS", category: RuleCategory.DEDUCTION, sequence: 80, computationType: ComputationType.PERCENTAGE, percentage: "10", percentageBase: PercentageBase.GROSS },
    { name: "Net Salary", code: "NET", category: RuleCategory.NET, sequence: 100, computationType: ComputationType.FORMULA, formula: "GROSS - PF - PT - LWP - TDS" },
  ]

  const INTERN_RULES: RuleSpec[] = [
    { name: "Stipend", code: "BASIC", category: RuleCategory.BASIC, sequence: 1, computationType: ComputationType.PERCENTAGE, percentage: "100", percentageBase: PercentageBase.CONTRACT_WAGE },
    { name: "Travel Allowance", code: "TRAVEL", category: RuleCategory.ALLOWANCE, sequence: 10, computationType: ComputationType.FIXED, amount: "1500" },
    { name: "Meal Allowance", code: "MEAL", category: RuleCategory.ALLOWANCE, sequence: 20, computationType: ComputationType.FIXED, amount: "1000" },
    { name: "Gross Salary", code: "GROSS", category: RuleCategory.GROSS, sequence: 50, computationType: ComputationType.FORMULA, formula: "BASIC + TRAVEL + MEAL" },
    { name: "Unpaid Leave Deduction", code: "LWP", category: RuleCategory.DEDUCTION, sequence: 70, computationType: ComputationType.FORMULA, formula: "round(unpaidLeaveDays * perDayRate, 2)" },
    { name: "Professional Tax", code: "PT", category: RuleCategory.DEDUCTION, sequence: 75, computationType: ComputationType.FIXED, amount: "200" },
    { name: "Net Salary", code: "NET", category: RuleCategory.NET, sequence: 100, computationType: ComputationType.FORMULA, formula: "GROSS - LWP - PT" },
  ]

  const CONTRACTOR_RULES: RuleSpec[] = [
    { name: "Consulting Fee", code: "BASIC", category: RuleCategory.BASIC, sequence: 1, computationType: ComputationType.PERCENTAGE, percentage: "100", percentageBase: PercentageBase.CONTRACT_WAGE },
    { name: "Attendance Adjustment", code: "ATT", category: RuleCategory.ALLOWANCE, sequence: 20, computationType: ComputationType.FORMULA, formula: "round(0 - BASIC * (scheduledDays - workedDays) / scheduledDays, 2)", condition: "workedDays < scheduledDays" },
    { name: "Gross Salary", code: "GROSS", category: RuleCategory.GROSS, sequence: 50, computationType: ComputationType.FORMULA, formula: "BASIC + ATT" },
    { name: "TDS (Contractor)", code: "TDS", category: RuleCategory.DEDUCTION, sequence: 80, computationType: ComputationType.PERCENTAGE, percentage: "10", percentageBase: PercentageBase.GROSS },
    { name: "Net Payable", code: "NET", category: RuleCategory.NET, sequence: 100, computationType: ComputationType.FORMULA, formula: "GROSS - TDS" },
  ]

  const STRUCTURES: Array<{ name: string; note: string; rules: RuleSpec[] }> = [
    { name: "Regular Salary", note: "Standard full-time structure.", rules: REGULAR_RULES },
    { name: "Intern Salary", note: "Stipend-based, no PF.", rules: INTERN_RULES },
    { name: "Contractor", note: "Fee-based with attendance adjustment.", rules: CONTRACTOR_RULES },
  ]

  const structureIds = new Map<string, string>()
  for (const s of STRUCTURES) {
    const structure = await db.salaryStructure.upsert({
      where: { companyId_name: { companyId: company.id, name: s.name } },
      update: { note: s.note, active: true },
      create: { name: s.name, note: s.note, active: true, companyId: company.id },
      select: { id: true },
    })
    structureIds.set(s.name, structure.id)

    for (const r of s.rules) {
      await db.salaryRule.upsert({
        where: { structureId_code: { structureId: structure.id, code: r.code } },
        update: {
          name: r.name,
          category: r.category,
          sequence: r.sequence,
          computationType: r.computationType,
          amount: r.amount ?? null,
          percentage: r.percentage ?? null,
          percentageBase: r.percentageBase ?? null,
          baseRuleCode: r.baseRuleCode ?? null,
          formula: r.formula ?? null,
          condition: r.condition ?? null,
          quantity: 1,
          active: true,
        },
        create: {
          structureId: structure.id,
          name: r.name,
          code: r.code,
          category: r.category,
          sequence: r.sequence,
          computationType: r.computationType,
          amount: r.amount ?? null,
          percentage: r.percentage ?? null,
          percentageBase: r.percentageBase ?? null,
          baseRuleCode: r.baseRuleCode ?? null,
          formula: r.formula ?? null,
          condition: r.condition ?? null,
          quantity: 1,
          active: true,
        },
      })
    }
  }
  const ruleTotal = STRUCTURES.reduce((n, s) => n + s.rules.length, 0)
  console.log(`  salary structures: ${structureIds.size} (${ruleTotal} rules)`)

  // Point every contract at the structure matching its employee type, so a
  // payrun has something to compute against.
  const regularId = structureIds.get("Regular Salary")!
  const internId = structureIds.get("Intern Salary")!
  const contractorId = structureIds.get("Contractor")!
  for (const spec of EMPLOYEES) {
    const structureId =
      spec.type === EmployeeType.INTERN
        ? internId
        : spec.type === EmployeeType.CONTRACT || spec.type === EmployeeType.FREELANCE
          ? contractorId
          : regularId
    await db.contract.updateMany({
      where: { employeeId: employeeIds.get(spec.code)! },
      data: { salaryStructureId: structureId },
    })
  }

  // ───────────────── Historical payruns (Apr–Aug 2026) ─────────────────
  // Paid runs so the dashboard trend has history. September is deliberately
  // left unmade — the demo creates it live through the wizard.
  const existingPayruns = await db.payrun.count()
  if (existingPayruns > 0) {
    console.log(`  payruns: ${existingPayruns} already present — skipping`)
  } else {
    const { computePayrunSlips, createPayrunWithPayslips, findEligibleEmployees } = await import(
      "../src/lib/payroll/payrun-service"
    )

    const MONTHS: Array<[number, number, string]> = [
      [2026, 3, "April 2026"],
      [2026, 4, "May 2026"],
      [2026, 5, "June 2026"],
      [2026, 6, "July 2026"],
      [2026, 7, "August 2026"],
    ]

    let slipTotal = 0
    for (const [year, month, name] of MONTHS) {
      const periodStart = utc(year, month, 1)
      const periodEnd = utc(year, month + 1, 0)

      const scope = {
        name,
        structureId: structureIds.get("Regular Salary")!,
        periodStart,
        periodEnd,
        employeeTypes: [],
        departmentId: null,
      }

      const eligible = await findEligibleEmployees(company.id, scope)
      if (eligible.length === 0) continue

      const payrun = await createPayrunWithPayslips(company.id, {
        ...scope,
        employeeIds: eligible.map((e) => e.id),
      })
      const { computed } = await computePayrunSlips(payrun.id)

      // Straight to PAID — these are closed historical periods.
      await db.$transaction([
        db.payslip.updateMany({
          where: { payrunId: payrun.id },
          data: { status: "PAID" },
        }),
        db.payrun.update({
          where: { id: payrun.id },
          data: {
            status: "PAID",
            computedAt: periodEnd,
            validatedAt: periodEnd,
            paidAt: periodEnd,
          },
        }),
      ])
      slipTotal += computed
      console.log(`    ${name}: ${computed} payslips`)
    }

    const totalNet = await db.payslip.aggregate({ _sum: { net: true } })
    console.log(
      `  payruns: ${MONTHS.length} paid (${slipTotal} payslips, net ${totalNet._sum.net}) — Sep 2026 left for the live demo`,
    )
  }

  // Warnings are regenerated for every payrun, including ones seeded earlier,
  // so the two employees without bank details are visible from the start.
  {
    const { regenerateWarnings } = await import("../src/lib/payroll/warnings")
    const runs = await db.payrun.findMany({ select: { id: true } })
    let total = 0
    for (const r of runs) total += (await regenerateWarnings(r.id)).total
    console.log(`  payroll warnings: ${total}`)
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10)
  for (const u of USERS) {
    await db.user.upsert({
      where: { email: u.email },
      update: { roles: u.roles, active: true, passwordHash },
      create: {
        email: u.email,
        passwordHash,
        roles: u.roles,
        active: true,
        employeeId: employeeIds.get(u.employeeCode)!,
      },
    })
  }
  console.log(`  users: ${USERS.length} (password: ${DEMO_PASSWORD})`)

  console.log("Seed complete.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
