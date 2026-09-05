/**
 * Idempotent seed — `npx prisma db seed` twice yields the same database.
 * Every record uses a stable natural key so upserts match on re-run.
 *
 * P0 scope: Company, Departments, Job Positions, Working Schedules, Employees, Users.
 * Later phases extend this file (contracts, attendance, time off, payroll).
 */
import {
  CalendarType,
  EmployeeType,
  Gender,
  PrismaClient,
  Role,
  Weekday,
} from "@prisma/client"
import bcrypt from "bcryptjs"

const db = new PrismaClient()

const COMPANY_NAME = "OXP Pvt Ltd"
const DEMO_PASSWORD = "demo1234"

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
        joiningDate: new Date(2024, i % 12, 1 + (i % 27)),
        active: true,
        avatarColor: AVATAR_COLORS[i % AVATAR_COLORS.length],
        personalEmail: `${spec.firstName.toLowerCase()}.${spec.lastName.toLowerCase()}@gmail.com`,
        dateOfBirth: new Date(1990 + (i % 12), i % 12, 1 + (i % 27)),
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
