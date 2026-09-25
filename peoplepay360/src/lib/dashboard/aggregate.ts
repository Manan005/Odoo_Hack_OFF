import {
  AttendanceStatus,
  ContractStatus,
  EmployeeType,
  PayrunStatus,
  PayslipStatus,
  Prisma,
  RequestStatus,
  WarningSeverity,
  Weekday,
} from "@prisma/client"
import { cache } from "react"
import { db } from "@/lib/db"
import { countScheduledDays } from "@/lib/payroll/worked-days"

/**
 * Every figure on the dashboard is a database aggregate computed here.
 * There is no constants file and no static series anywhere (rules.md §0.3).
 *
 * The database is remote, so the cost is round trips, not rows. Three rules
 * keep a render to one parallel wave of statements:
 *
 *   1. Scope through the relation (`employee: { companyId, … }`), which
 *      Postgres answers as a sub-select, instead of fetching the matching
 *      employee ids first and shipping them back in an `IN (…)` list.
 *   2. Each function issues its statements together in one Promise.all.
 *   3. Figures that several cards need (payslip totals, status counts, the
 *      roster) are memoised per request with React `cache()`, and so is
 *      every exported aggregate, so Suspense sections that ask for the same
 *      thing share one query. Outside a React server render (the tsx gate
 *      scripts) `cache()` is a pass-through and every call queries afresh.
 */
export interface DashboardFilters {
  companyId: string
  periodStart: Date
  periodEnd: Date
  departmentId?: string
  employeeType?: EmployeeType
}

// ───────────────────────────── Request memo ─────────────────────────────

/*
 * `cache()` compares arguments by identity, so a filters object built twice
 * would never hit. Memoised functions therefore take the filters flattened
 * to primitives: company, department ("" = all), type ("" = all), and the
 * period bounds as epoch milliseconds.
 */
type Key = [companyId: string, departmentId: string, employeeType: string, start: number, end: number]

const keyOf = (f: DashboardFilters): Key => [
  f.companyId,
  f.departmentId ?? "",
  f.employeeType ?? "",
  f.periodStart.getTime(),
  f.periodEnd.getTime(),
]

const fromKey = (...[companyId, departmentId, employeeType, start, end]: Key): DashboardFilters => ({
  companyId,
  departmentId: departmentId || undefined,
  employeeType: (employeeType || undefined) as EmployeeType | undefined,
  periodStart: new Date(start),
  periodEnd: new Date(end),
})

/** Wraps an aggregate so identical filters within one request query once. */
function memo<T>(fn: (f: DashboardFilters) => Promise<T>): (f: DashboardFilters) => Promise<T> {
  const cached = cache((...key: Key) => fn(fromKey(...key)))
  return (f) => cached(...keyOf(f))
}

// ───────────────────────────── Shared scope ─────────────────────────────

/** Employees matching the department / type filters, as a relation filter. */
const scopeOf = (f: DashboardFilters): Prisma.EmployeeWhereInput => ({
  companyId: f.companyId,
  ...(f.departmentId ? { departmentId: f.departmentId } : {}),
  ...(f.employeeType ? { employeeType: f.employeeType } : {}),
})

/** Payslips whose pay period lies inside the selected one. */
const payslipsIn = (f: DashboardFilters): Prisma.PayslipWhereInput => ({
  employee: scopeOf(f),
  periodStart: { gte: f.periodStart },
  periodEnd: { lte: f.periodEnd },
})

/** Payruns whose pay period lies inside the selected one. */
const payrunsIn = (f: DashboardFilters): Prisma.PayrunWhereInput => ({
  companyId: f.companyId,
  periodStart: { gte: f.periodStart },
  periodEnd: { lte: f.periodEnd },
})

/** Approved requests overlapping the selected period. */
const approvedTimeOffIn = (f: DashboardFilters): Prisma.TimeOffRequestWhereInput => ({
  employee: scopeOf(f),
  status: RequestStatus.APPROVED,
  startDate: { lte: f.periodEnd },
  endDate: { gte: f.periodStart },
})

const num = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0)

// ─────────────────────────── Shared loaders ───────────────────────────

/** Summed payslip roll-ups for the period: KPI, net composition and counts all read it. */
const loadPayslipTotals = memo((f) =>
  db.payslip.aggregate({
    where: payslipsIn(f),
    _sum: { basic: true, allowances: true, gross: true, deductions: true, net: true },
    _count: true,
  }),
)

/** Payslips per status for the period: the KPI's paid count and the status bar. */
const loadPayslipStatus = memo((f) =>
  db.payslip.groupBy({ by: ["status"], where: payslipsIn(f), _count: true }),
)

/** Attendance per status for every scoped employee: KPI health and the row count. */
const loadAttendanceStatus = memo((f) =>
  db.attendance.groupBy({
    by: ["status"],
    where: { employee: scopeOf(f), checkIn: { gte: f.periodStart, lte: f.periodEnd } },
    _count: true,
  }),
)

/** Approved time off overlapping the period: the KPI's days and the row count. */
const loadApprovedTimeOff = memo((f) =>
  db.timeOffRequest.aggregate({ where: approvedTimeOffIn(f), _sum: { duration: true }, _count: true }),
)

interface RosterEmployee {
  id: string
  active: boolean
  department: string
  /** Weekdays on the employee's working schedule; empty when none is set. */
  scheduleDays: Weekday[]
  /** Wage of the newest running contract overlapping the period, if any. */
  wage: number | null
}

/**
 * Every scoped employee (active or not) with the facts three panels need:
 * department name, schedule days and current wage. Four flat statements in
 * parallel; nested relation selects would each cost a serial round trip.
 */
const loadRoster = memo(async (f): Promise<RosterEmployee[]> => {
  const scope = scopeOf(f)
  const activeScope = { ...scope, active: true }
  const [employees, departments, contracts, lines] = await Promise.all([
    db.employee.findMany({
      where: scope,
      select: { id: true, active: true, departmentId: true, workingScheduleId: true },
    }),
    db.department.findMany({ where: { employees: { some: scope } }, select: { id: true, name: true } }),
    db.contract.findMany({
      where: {
        employee: activeScope,
        status: ContractStatus.RUNNING,
        startDate: { lte: f.periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: f.periodStart } }],
      },
      orderBy: { startDate: "desc" },
      select: { employeeId: true, wage: true },
    }),
    db.scheduleLine.findMany({
      where: { schedule: { employees: { some: activeScope } } },
      select: { scheduleId: true, day: true },
    }),
  ])

  const departmentName = new Map(departments.map((d) => [d.id, d.name]))
  // Contracts arrive newest first, so the first one seen per employee wins.
  const wageOf = new Map<string, number>()
  for (const c of contracts) if (!wageOf.has(c.employeeId)) wageOf.set(c.employeeId, num(c.wage))
  const daysOf = new Map<string, Weekday[]>()
  for (const l of lines) daysOf.set(l.scheduleId, [...(daysOf.get(l.scheduleId) ?? []), l.day])

  return employees.map((e) => ({
    id: e.id,
    active: e.active,
    department: (e.departmentId && departmentName.get(e.departmentId)) || "Unassigned",
    scheduleDays: (e.workingScheduleId && daysOf.get(e.workingScheduleId)) || [],
    wage: e.active ? (wageOf.get(e.id) ?? null) : null,
  }))
})

// ───────────────────────────── KPI cards ─────────────────────────────

export interface Kpis {
  totalNet: number
  netDeltaPct: number | null
  /** Net of the previous calendar month — what the delta is measured against. */
  prevNet: number
  payslipsGenerated: number
  payslipsPaid: number
  payslipsPending: number
  avgSalary: number
  approvedTimeOffDays: number
  attendanceHealthPct: number
  presentish: number
  expectedRecords: number
}

export const getKpis = memo(async (f): Promise<Kpis> => {
  // Previous calendar month, for the delta on the salary card.
  //
  // Subtracting the period's own span instead lands a millisecond past the
  // previous month's first day, because the period ends at 23:59:59 — and the
  // `gte` on periodStart then silently excludes every payslip in it.
  const prevStart = new Date(
    Date.UTC(f.periodStart.getUTCFullYear(), f.periodStart.getUTCMonth() - 1, 1),
  )
  const prevEnd = new Date(
    Date.UTC(f.periodStart.getUTCFullYear(), f.periodStart.getUTCMonth(), 0, 23, 59, 59),
  )

  const [current, previous, statusCounts, timeOff, attendance] = await Promise.all([
    loadPayslipTotals(f),
    db.payslip.aggregate({
      where: payslipsIn({ ...f, periodStart: prevStart, periodEnd: prevEnd }),
      _sum: { net: true },
    }),
    loadPayslipStatus(f),
    loadApprovedTimeOff(f),
    loadAttendanceStatus(f),
  ])

  const totalNet = num(current._sum.net)
  const prevNet = num(previous._sum.net)
  const netDeltaPct = prevNet > 0 ? ((totalNet - prevNet) / prevNet) * 100 : null

  const byStatus = new Map(statusCounts.map((s) => [s.status, s._count]))
  const payslipsPaid = byStatus.get(PayslipStatus.PAID) ?? 0
  const payslipsGenerated = current._count

  // Attendance health: records that are not an absence, over all records.
  const totalRecords = attendance.reduce((n, a) => n + a._count, 0)
  const absent =
    attendance.find((a) => a.status === AttendanceStatus.ABSENT)?._count ?? 0
  const presentish = totalRecords - absent

  return {
    totalNet,
    netDeltaPct,
    prevNet,
    payslipsGenerated,
    payslipsPaid,
    payslipsPending: payslipsGenerated - payslipsPaid,
    avgSalary: payslipsGenerated > 0 ? totalNet / payslipsGenerated : 0,
    approvedTimeOffDays: num(timeOff._sum.duration),
    attendanceHealthPct: totalRecords > 0 ? (presentish / totalRecords) * 100 : 0,
    presentish,
    expectedRecords: totalRecords,
  }
})

// ─────────────────────────── Salary by department ───────────────────────────

export interface DepartmentSalary {
  department: string
  net: number
  headcount: number
}

export const getSalaryByDepartment = memo(async (f): Promise<DepartmentSalary[]> => {
  const [roster, payslips] = await Promise.all([
    loadRoster(f),
    db.payslip.groupBy({ by: ["employeeId"], where: payslipsIn(f), _sum: { net: true } }),
  ])
  const netByEmployee = new Map(payslips.map((p) => [p.employeeId, num(p._sum.net)]))

  const totals = new Map<string, { net: number; headcount: number }>()
  for (const e of roster) {
    const row = totals.get(e.department) ?? { net: 0, headcount: 0 }
    row.net += netByEmployee.get(e.id) ?? 0
    row.headcount += 1
    totals.set(e.department, row)
  }

  return [...totals.entries()]
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.net - a.net)
})

// ───────────────────────────── Monthly trend ─────────────────────────────

export interface TrendPoint {
  label: string
  net: number
  payslips: number
}

/** The last six periods that actually have payslips, oldest first. */
export const getMonthlyTrend = memo(async (f): Promise<TrendPoint[]> => {
  // Grouped in the database: one row per distinct period start, not one per payslip.
  const periods = await db.payslip.groupBy({
    by: ["periodStart"],
    where: { employee: scopeOf(f), periodStart: { lte: f.periodEnd } },
    _sum: { net: true },
    _count: true,
    orderBy: { periodStart: "desc" },
  })

  const buckets = new Map<string, { net: number; payslips: number; at: Date }>()
  for (const p of periods) {
    const key = `${p.periodStart.getUTCFullYear()}-${String(p.periodStart.getUTCMonth() + 1).padStart(2, "0")}`
    const row = buckets.get(key) ?? { net: 0, payslips: 0, at: p.periodStart }
    row.net += num(p._sum.net)
    row.payslips += p._count
    buckets.set(key, row)
  }

  return [...buckets.entries()]
    .sort((a, b) => b[1].at.getTime() - a[1].at.getTime())
    .slice(0, 6)
    .reverse()
    .map(([, v]) => ({
      label: v.at.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" }),
      net: v.net,
      payslips: v.payslips,
    }))
})

// ──────────────────── Payslip status split & alerts ────────────────────

export interface StatusSplit {
  status: string
  count: number
}

export interface AlertRow {
  code: string
  severity: string
  message: string
  payslipId: string | null
}

export const getPayslipStatusSplit = memo(
  async (f): Promise<{ split: StatusSplit[]; alerts: AlertRow[] }> => {
    const [roster, grouped, warnings] = await Promise.all([
      loadRoster(f),
      loadPayslipStatus(f),
      db.payrollWarning.findMany({
        where: { payrun: payrunsIn(f) },
        select: { code: true, severity: true, message: true, payslipId: true },
        orderBy: { severity: "asc" },
        take: 12,
      }),
    ])
    // Warnings belong to the payrun, not to an employee: a filter that
    // matches nobody shows none rather than the whole company's.
    if (roster.length === 0) return { split: [], alerts: [] }

    return {
      split: grouped.map((g) => ({ status: g.status, count: g._count })),
      alerts: warnings,
    }
  },
)

// ─────────────────────────── Attendance overview ───────────────────────────

export interface AttendanceOverview {
  present: number
  late: number
  absent: number
  halfDay: number
  overtimeRecords: number
  overtimeHours: number
  missingCheckOuts: number
  manualEdits: number
  coveragePct: number
}

/** Active employees only: attendance is expected of people still on the books. */
export const getAttendanceOverview = memo(async (f): Promise<AttendanceOverview> => {
  const inPeriod: Prisma.AttendanceWhereInput = {
    employee: { ...scopeOf(f), active: true },
    checkIn: { gte: f.periodStart, lte: f.periodEnd },
  }

  const [roster, grouped, overtime, missing, manual] = await Promise.all([
    loadRoster(f),
    db.attendance.groupBy({ by: ["status"], where: inPeriod, _count: true }),
    db.attendance.aggregate({
      where: { ...inPeriod, overtime: { gt: 0 } },
      _count: true,
      _sum: { overtime: true },
    }),
    db.attendance.count({
      where: { ...inPeriod, checkOut: null, status: { not: AttendanceStatus.ABSENT } },
    }),
    db.attendance.count({ where: { ...inPeriod, manuallyEdited: true } }),
  ])

  const by = new Map(grouped.map((g) => [g.status, g._count]))
  const total = grouped.reduce((n, g) => n + g._count, 0)

  // Coverage: records logged against working days that should have one.
  const expected = roster
    .filter((e) => e.active)
    .reduce((sum, e) => sum + countScheduledDays(f.periodStart, f.periodEnd, e.scheduleDays), 0)

  return {
    present: by.get(AttendanceStatus.PRESENT) ?? 0,
    late: by.get(AttendanceStatus.LATE) ?? 0,
    absent: by.get(AttendanceStatus.ABSENT) ?? 0,
    halfDay: by.get(AttendanceStatus.HALF_DAY) ?? 0,
    overtimeRecords: overtime._count,
    overtimeHours: num(overtime._sum.overtime),
    missingCheckOuts: missing,
    manualEdits: manual,
    coveragePct: expected > 0 ? Math.min(100, (total / expected) * 100) : 0,
  }
})

// ──────────────────────────── Time off overview ────────────────────────────

export interface TimeOffOverviewRow {
  type: string
  unit: string
  approvedDays: number
  pending: number
  remainingBalance: number | null
}

export const getTimeOffOverview = memo(async (f): Promise<TimeOffOverviewRow[]> => {
  const scope = scopeOf(f)
  const [roster, types, approved, pending, allocations] = await Promise.all([
    loadRoster(f),
    db.timeOffType.findMany({
      where: { companyId: f.companyId, active: true },
      select: { id: true, name: true, unit: true, requiresAllocation: true },
      orderBy: { name: "asc" },
    }),
    db.timeOffRequest.groupBy({ by: ["typeId"], where: approvedTimeOffIn(f), _sum: { duration: true } }),
    db.timeOffRequest.groupBy({
      by: ["typeId"],
      where: { employee: scope, status: RequestStatus.TO_APPROVE },
      _count: true,
    }),
    // BR-T5: remaining is derived, allocated − taken, summed per type.
    db.timeOffAllocation.groupBy({
      by: ["typeId"],
      where: { employee: scope, status: RequestStatus.APPROVED },
      _sum: { allocated: true, taken: true },
    }),
  ])
  if (roster.length === 0) return []

  const approvedByType = new Map(approved.map((a) => [a.typeId, num(a._sum.duration)]))
  const pendingByType = new Map(pending.map((p) => [p.typeId, p._count]))
  const remainingByType = new Map(
    allocations.map((a) => [
      a.typeId,
      Number((num(a._sum.allocated) - num(a._sum.taken)).toFixed(2)),
    ]),
  )

  return types.map((t) => ({
    type: t.name,
    unit: t.unit,
    approvedDays: approvedByType.get(t.id) ?? 0,
    pending: pendingByType.get(t.id) ?? 0,
    // A type needing no allocation has no balance to report.
    remainingBalance: t.requiresAllocation ? (remainingByType.get(t.id) ?? 0) : null,
  }))
})

// ─────────────────────────── Department overview ───────────────────────────

export interface DepartmentOverviewRow {
  department: string
  headcount: number
  monthlySalary: number
}

/** Headcount and committed monthly wage from running contracts (active staff). */
export const getDepartmentOverview = memo(async (f): Promise<DepartmentOverviewRow[]> => {
  const roster = await loadRoster(f)

  const totals = new Map<string, { headcount: number; monthlySalary: number }>()
  for (const e of roster) {
    if (!e.active) continue
    const row = totals.get(e.department) ?? { headcount: 0, monthlySalary: 0 }
    row.headcount += 1
    row.monthlySalary += e.wage ?? 0
    totals.set(e.department, row)
  }

  return [...totals.entries()]
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.monthlySalary - a.monthlySalary)
})

// ───────────────────────── Latest payslip period ─────────────────────────

/**
 * The newest calendar month that has a payslip for the company, as `YYYY-MM`.
 * The dashboard defaults to it so the first paint is never a month of zeros.
 */
export async function getLatestPayslipPeriod(companyId: string): Promise<string | null> {
  const latest = await db.payslip.findFirst({
    where: { payrun: { companyId } },
    orderBy: { periodStart: "desc" },
    select: { periodStart: true },
  })
  if (!latest) return null
  const d = latest.periodStart
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`
}

// ─────────────────────────── Period payrun ───────────────────────────

export interface PeriodPayrun {
  id: string
  name: string
  status: PayrunStatus
  payslips: number
  /** Every payslip in the run has been emailed — the stepper's fifth step. */
  allSent: boolean
}

/** The payrun covering the selected period, or null when none exists yet. */
export const getPeriodPayrun = memo(async (f): Promise<PeriodPayrun | null> => {
  // Payslip and sent counts for every payrun in the period, fetched beside the
  // payrun itself; `_count.sentAt` counts the non-null ones.
  const [payrun, perRun] = await Promise.all([
    db.payrun.findFirst({
      where: payrunsIn(f),
      orderBy: { createdAt: "desc" },
      select: { id: true, name: true, status: true },
    }),
    db.payslip.groupBy({
      by: ["payrunId"],
      where: { payrun: payrunsIn(f) },
      _count: { _all: true, sentAt: true },
    }),
  ])
  if (!payrun) return null

  const counts = perRun.find((r) => r.payrunId === payrun.id)?._count
  const payslips = counts?._all ?? 0
  return {
    id: payrun.id,
    name: payrun.name,
    status: payrun.status,
    payslips,
    allSent: payslips > 0 && (counts?.sentAt ?? 0) === payslips,
  }
})

// ─────────────────────────── Net composition ───────────────────────────

export interface NetComposition {
  basic: number
  allowances: number
  gross: number
  deductions: number
  net: number
  payslips: number
}

/**
 * Summed payslip roll-ups for the period: basic + allowances build the gross,
 * deductions come off it, net is what remains. The three-stripe brand mark
 * is literally the legend for this band.
 */
export const getNetComposition = memo(async (f): Promise<NetComposition> => {
  const agg = await loadPayslipTotals(f)
  return {
    basic: num(agg._sum.basic),
    allowances: num(agg._sum.allowances),
    gross: num(agg._sum.gross),
    deductions: num(agg._sum.deductions),
    net: num(agg._sum.net),
    payslips: agg._count,
  }
})

// ───────────────────────────── Model counts ─────────────────────────────

export interface ModelCounts {
  employees: number
  contracts: number
  payslips: number
  attendance: number
  timeOff: number
}

/**
 * The five row counts behind the page, scoped by the same filters as every
 * other figure — the cheapest proof that nothing here is a constant.
 */
export const getModelCounts = memo(async (f): Promise<ModelCounts> => {
  const [roster, contracts, payslips, attendance, timeOff] = await Promise.all([
    loadRoster(f),
    db.contract.count({ where: { employee: scopeOf(f), status: ContractStatus.RUNNING } }),
    loadPayslipTotals(f),
    loadAttendanceStatus(f),
    loadApprovedTimeOff(f),
  ])

  return {
    employees: roster.filter((e) => e.active).length,
    contracts,
    payslips: payslips._count,
    attendance: attendance.reduce((n, a) => n + a._count, 0),
    timeOff: timeOff._count,
  }
})

// ───────────────────────── Warning severity counts ─────────────────────────

export interface WarningSeverityCounts {
  blocking: number
  warning: number
  info: number
}

/**
 * Grouped counts for the alerts header. The alerts list itself is capped at
 * twelve rows, so totals must never be derived from it.
 */
export const getWarningSeverityCounts = memo(async (f): Promise<WarningSeverityCounts> => {
  const grouped = await db.payrollWarning.groupBy({
    by: ["severity"],
    where: { payrun: payrunsIn(f) },
    _count: true,
  })
  const by = new Map(grouped.map((g) => [g.severity, g._count]))
  return {
    blocking: by.get(WarningSeverity.BLOCKING) ?? 0,
    warning: by.get(WarningSeverity.WARNING) ?? 0,
    info: by.get(WarningSeverity.INFO) ?? 0,
  }
})
