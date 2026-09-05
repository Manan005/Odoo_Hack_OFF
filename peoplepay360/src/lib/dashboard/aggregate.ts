import {
  AttendanceStatus,
  ContractStatus,
  EmployeeType,
  PayslipStatus,
  Prisma,
  RequestStatus,
  Weekday,
} from "@prisma/client"
import { db } from "@/lib/db"
import { countScheduledDays } from "@/lib/payroll/worked-days"
import { balanceOf } from "@/lib/timeoff/balance"

/**
 * Every figure on the dashboard is a database aggregate computed here.
 * There is no constants file and no static series anywhere (rules.md §0.3).
 */
export interface DashboardFilters {
  companyId: string
  periodStart: Date
  periodEnd: Date
  departmentId?: string
  employeeType?: EmployeeType
}

/** Employees matching the department / type filters, for scoping every query. */
async function scopedEmployeeIds(f: DashboardFilters): Promise<string[]> {
  const rows = await db.employee.findMany({
    where: {
      companyId: f.companyId,
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.employeeType ? { employeeType: f.employeeType } : {}),
    },
    select: { id: true },
  })
  return rows.map((r) => r.id)
}

const num = (v: Prisma.Decimal | number | null | undefined) => Number(v ?? 0)

// ───────────────────────────── KPI cards ─────────────────────────────

export interface Kpis {
  totalNet: number
  netDeltaPct: number | null
  payslipsGenerated: number
  payslipsPaid: number
  payslipsPending: number
  avgSalary: number
  approvedTimeOffDays: number
  attendanceHealthPct: number
  presentish: number
  expectedRecords: number
}

export async function getKpis(f: DashboardFilters): Promise<Kpis> {
  const employeeIds = await scopedEmployeeIds(f)
  if (employeeIds.length === 0) {
    return {
      totalNet: 0,
      netDeltaPct: null,
      payslipsGenerated: 0,
      payslipsPaid: 0,
      payslipsPending: 0,
      avgSalary: 0,
      approvedTimeOffDays: 0,
      attendanceHealthPct: 0,
      presentish: 0,
      expectedRecords: 0,
    }
  }

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

  const inPeriod = {
    employeeId: { in: employeeIds },
    periodStart: { gte: f.periodStart },
    periodEnd: { lte: f.periodEnd },
  }

  const [current, previous, statusCounts, timeOff, attendance] = await Promise.all([
    db.payslip.aggregate({ where: inPeriod, _sum: { net: true }, _count: true }),
    db.payslip.aggregate({
      where: {
        employeeId: { in: employeeIds },
        periodStart: { gte: prevStart },
        periodEnd: { lte: prevEnd },
      },
      _sum: { net: true },
    }),
    db.payslip.groupBy({ by: ["status"], where: inPeriod, _count: true }),
    db.timeOffRequest.aggregate({
      where: {
        employeeId: { in: employeeIds },
        status: RequestStatus.APPROVED,
        startDate: { lte: f.periodEnd },
        endDate: { gte: f.periodStart },
      },
      _sum: { duration: true },
    }),
    db.attendance.groupBy({
      by: ["status"],
      where: {
        employeeId: { in: employeeIds },
        checkIn: { gte: f.periodStart, lte: f.periodEnd },
      },
      _count: true,
    }),
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
    payslipsGenerated,
    payslipsPaid,
    payslipsPending: payslipsGenerated - payslipsPaid,
    avgSalary: payslipsGenerated > 0 ? totalNet / payslipsGenerated : 0,
    approvedTimeOffDays: num(timeOff._sum.duration),
    attendanceHealthPct: totalRecords > 0 ? (presentish / totalRecords) * 100 : 0,
    presentish,
    expectedRecords: totalRecords,
  }
}

// ─────────────────────────── Salary by department ───────────────────────────

export interface DepartmentSalary {
  department: string
  net: number
  headcount: number
}

export async function getSalaryByDepartment(
  f: DashboardFilters,
): Promise<DepartmentSalary[]> {
  const employees = await db.employee.findMany({
    where: {
      companyId: f.companyId,
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.employeeType ? { employeeType: f.employeeType } : {}),
    },
    select: { id: true, department: { select: { name: true } } },
  })
  if (employees.length === 0) return []

  const payslips = await db.payslip.groupBy({
    by: ["employeeId"],
    where: {
      employeeId: { in: employees.map((e) => e.id) },
      periodStart: { gte: f.periodStart },
      periodEnd: { lte: f.periodEnd },
    },
    _sum: { net: true },
  })
  const netByEmployee = new Map(payslips.map((p) => [p.employeeId, num(p._sum.net)]))

  const totals = new Map<string, { net: number; headcount: number }>()
  for (const e of employees) {
    const name = e.department?.name ?? "Unassigned"
    const row = totals.get(name) ?? { net: 0, headcount: 0 }
    row.net += netByEmployee.get(e.id) ?? 0
    row.headcount += 1
    totals.set(name, row)
  }

  return [...totals.entries()]
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.net - a.net)
}

// ───────────────────────────── Monthly trend ─────────────────────────────

export interface TrendPoint {
  label: string
  net: number
  payslips: number
}

/** The last six periods that actually have payslips, oldest first. */
export async function getMonthlyTrend(f: DashboardFilters): Promise<TrendPoint[]> {
  const employeeIds = await scopedEmployeeIds(f)
  if (employeeIds.length === 0) return []

  const payslips = await db.payslip.findMany({
    where: { employeeId: { in: employeeIds }, periodStart: { lte: f.periodEnd } },
    select: { periodStart: true, net: true },
    orderBy: { periodStart: "desc" },
    take: 2000,
  })

  const buckets = new Map<string, { net: number; payslips: number; at: Date }>()
  for (const p of payslips) {
    const key = `${p.periodStart.getUTCFullYear()}-${String(p.periodStart.getUTCMonth() + 1).padStart(2, "0")}`
    const row = buckets.get(key) ?? { net: 0, payslips: 0, at: p.periodStart }
    row.net += num(p.net)
    row.payslips += 1
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
}

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

export async function getPayslipStatusSplit(f: DashboardFilters): Promise<{
  split: StatusSplit[]
  alerts: AlertRow[]
}> {
  const employeeIds = await scopedEmployeeIds(f)
  if (employeeIds.length === 0) return { split: [], alerts: [] }

  const [grouped, warnings] = await Promise.all([
    db.payslip.groupBy({
      by: ["status"],
      where: {
        employeeId: { in: employeeIds },
        periodStart: { gte: f.periodStart },
        periodEnd: { lte: f.periodEnd },
      },
      _count: true,
    }),
    db.payrollWarning.findMany({
      where: {
        payrun: {
          companyId: f.companyId,
          periodStart: { gte: f.periodStart },
          periodEnd: { lte: f.periodEnd },
        },
      },
      select: { code: true, severity: true, message: true, payslipId: true },
      orderBy: { severity: "asc" },
      take: 12,
    }),
  ])

  return {
    split: grouped.map((g) => ({ status: g.status, count: g._count })),
    alerts: warnings,
  }
}

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

export async function getAttendanceOverview(
  f: DashboardFilters,
): Promise<AttendanceOverview> {
  const employees = await db.employee.findMany({
    where: {
      companyId: f.companyId,
      active: true,
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.employeeType ? { employeeType: f.employeeType } : {}),
    },
    select: { id: true, workingSchedule: { select: { lines: { select: { day: true } } } } },
  })
  const employeeIds = employees.map((e) => e.id)
  if (employeeIds.length === 0) {
    return {
      present: 0,
      late: 0,
      absent: 0,
      halfDay: 0,
      overtimeRecords: 0,
      overtimeHours: 0,
      missingCheckOuts: 0,
      manualEdits: 0,
      coveragePct: 0,
    }
  }

  const inPeriod = {
    employeeId: { in: employeeIds },
    checkIn: { gte: f.periodStart, lte: f.periodEnd },
  }

  const [grouped, overtime, missing, manual, total] = await Promise.all([
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
    db.attendance.count({ where: inPeriod }),
  ])

  const by = new Map(grouped.map((g) => [g.status, g._count]))

  // Coverage: records logged against working days that should have one.
  const expected = employees.reduce(
    (sum, e) =>
      sum +
      countScheduledDays(
        f.periodStart,
        f.periodEnd,
        (e.workingSchedule?.lines ?? []).map((l) => l.day as Weekday),
      ),
    0,
  )

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
}

// ──────────────────────────── Time off overview ────────────────────────────

export interface TimeOffOverviewRow {
  type: string
  unit: string
  approvedDays: number
  pending: number
  remainingBalance: number | null
}

export async function getTimeOffOverview(
  f: DashboardFilters,
): Promise<TimeOffOverviewRow[]> {
  const employeeIds = await scopedEmployeeIds(f)
  if (employeeIds.length === 0) return []

  const types = await db.timeOffType.findMany({
    where: { companyId: f.companyId, active: true },
    select: { id: true, name: true, unit: true, requiresAllocation: true },
    orderBy: { name: "asc" },
  })

  const [approved, pending, allocations] = await Promise.all([
    db.timeOffRequest.groupBy({
      by: ["typeId"],
      where: {
        employeeId: { in: employeeIds },
        status: RequestStatus.APPROVED,
        startDate: { lte: f.periodEnd },
        endDate: { gte: f.periodStart },
      },
      _sum: { duration: true },
    }),
    db.timeOffRequest.groupBy({
      by: ["typeId"],
      where: { employeeId: { in: employeeIds }, status: RequestStatus.TO_APPROVE },
      _count: true,
    }),
    db.timeOffAllocation.findMany({
      where: { employeeId: { in: employeeIds }, status: RequestStatus.APPROVED },
      select: { typeId: true, allocated: true, taken: true },
    }),
  ])

  const approvedByType = new Map(approved.map((a) => [a.typeId, num(a._sum.duration)]))
  const pendingByType = new Map(pending.map((p) => [p.typeId, p._count]))
  const remainingByType = new Map<string, number>()
  for (const a of allocations) {
    remainingByType.set(
      a.typeId,
      (remainingByType.get(a.typeId) ?? 0) + balanceOf(a).remaining,
    )
  }

  return types.map((t) => ({
    type: t.name,
    unit: t.unit,
    approvedDays: approvedByType.get(t.id) ?? 0,
    pending: pendingByType.get(t.id) ?? 0,
    // A type needing no allocation has no balance to report.
    remainingBalance: t.requiresAllocation ? (remainingByType.get(t.id) ?? 0) : null,
  }))
}

// ─────────────────────────── Department overview ───────────────────────────

export interface DepartmentOverviewRow {
  department: string
  headcount: number
  monthlySalary: number
}

/** Headcount and committed monthly wage from running contracts. */
export async function getDepartmentOverview(
  f: DashboardFilters,
): Promise<DepartmentOverviewRow[]> {
  const employees = await db.employee.findMany({
    where: {
      companyId: f.companyId,
      active: true,
      ...(f.departmentId ? { departmentId: f.departmentId } : {}),
      ...(f.employeeType ? { employeeType: f.employeeType } : {}),
    },
    select: {
      id: true,
      department: { select: { name: true } },
      contracts: {
        where: {
          status: ContractStatus.RUNNING,
          startDate: { lte: f.periodEnd },
          OR: [{ endDate: null }, { endDate: { gte: f.periodStart } }],
        },
        orderBy: { startDate: "desc" },
        take: 1,
        select: { wage: true },
      },
    },
  })

  const totals = new Map<string, { headcount: number; monthlySalary: number }>()
  for (const e of employees) {
    const name = e.department?.name ?? "Unassigned"
    const row = totals.get(name) ?? { headcount: 0, monthlySalary: 0 }
    row.headcount += 1
    row.monthlySalary += num(e.contracts[0]?.wage)
    totals.set(name, row)
  }

  return [...totals.entries()]
    .map(([department, v]) => ({ department, ...v }))
    .sort((a, b) => b.monthlySalary - a.monthlySalary)
}
