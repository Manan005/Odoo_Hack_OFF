import {
  ContractStatus,
  PayrunStatus,
  PayslipStatus,
  RequestStatus,
  Weekday,
} from "@prisma/client"
import { db } from "@/lib/db"
import { fmtPeriod } from "@/lib/dates"
import { buildContext, computePayslip } from "@/lib/payroll/engine"
import { blockingWarnings, regenerateWarnings } from "@/lib/payroll/warnings"
import { PayrunError } from "@/lib/result"
import type { CreatePayrunInput, PayrunScopeInput } from "@/lib/validation/payroll"

/**
 * Payrun business logic, free of auth and revalidation so it can be exercised
 * directly by the gate scripts (rules.md §2.1 — logic lives in lib/, actions
 * are the guard boundary).
 */

export interface EligibleEmployee {
  id: string
  name: string
  employeeCode: string
  department: string | null
  scheduleName: string | null
  hoursPerWeek: number
  contractStart: string
  wage: string
}

/** Wizard step 2 data. Read-only — this is why the wizard writes nothing. */
export async function findEligibleEmployees(
  companyId: string,
  scope: PayrunScopeInput,
): Promise<EligibleEmployee[]> {
  const periodFilter = {
    status: ContractStatus.RUNNING,
    startDate: { lte: scope.periodEnd },
    OR: [{ endDate: null }, { endDate: { gte: scope.periodStart } }],
  }

  const employees = await db.employee.findMany({
    where: {
      active: true,
      companyId,
      ...(scope.employeeTypes.length > 0 ? { employeeType: { in: scope.employeeTypes } } : {}),
      ...(scope.departmentId ? { departmentId: scope.departmentId } : {}),
      // Eligible only with a contract covering the period (BR-C2).
      contracts: { some: periodFilter },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      employeeCode: true,
      department: { select: { name: true } },
      contracts: {
        where: periodFilter,
        orderBy: { startDate: "desc" },
        take: 1,
        select: {
          wage: true,
          startDate: true,
          workingSchedule: { select: { name: true, hoursPerWeek: true } },
        },
      },
    },
    orderBy: { firstName: "asc" },
  })

  return employees.map((e) => {
    const contract = e.contracts[0]
    return {
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      employeeCode: e.employeeCode,
      department: e.department?.name ?? null,
      scheduleName: contract?.workingSchedule?.name ?? null,
      hoursPerWeek: Number(contract?.workingSchedule?.hoursPerWeek ?? 0),
      contractStart: contract ? contract.startDate.toISOString().slice(0, 10) : "",
      wage: contract ? String(contract.wage) : "0",
    }
  })
}

export async function createPayrunWithPayslips(
  companyId: string,
  input: CreatePayrunInput,
): Promise<{ id: string }> {
  const structure = await db.salaryStructure.findUnique({
    where: { id: input.structureId },
    select: { id: true },
  })
  if (!structure) {
    throw new PayrunError("NO_STRUCTURE", "That salary structure no longer exists.")
  }

  return db.$transaction(async (tx) => {
    const payrun = await tx.payrun.create({
      data: {
        name: input.name ?? fmtPeriod(input.periodStart),
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: PayrunStatus.DRAFT,
        employeeTypes: input.employeeTypes,
        structureId: structure.id,
        companyId,
      },
      select: { id: true },
    })

    const lastRef = await tx.payslip.findFirst({
      where: { reference: { startsWith: "SLIP/" } },
      orderBy: { reference: "desc" },
      select: { reference: true },
    })
    let seq = lastRef ? Number(lastRef.reference.split("/")[2]) : 0
    const year = input.periodStart.getFullYear()

    // Only the selected employees are included (AC-M8-2).
    await tx.payslip.createMany({
      data: input.employeeIds.map((employeeId) => ({
        reference: `SLIP/${year}/${String(++seq).padStart(4, "0")}`,
        employeeId,
        payrunId: payrun.id,
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        status: PayslipStatus.DRAFT,
      })),
    })

    return payrun
  })
}

/**
 * Compute every payslip in the run. Idempotent — the unique constraint on
 * (payrunId, employeeId) means recomputing replaces lines rather than
 * duplicating payslips (AC-M8-3).
 */
export async function computePayrunSlips(
  payrunId: string,
): Promise<{ computed: number; skipped: number; warnings: number; blocking: number }> {
  const payrun = await db.payrun.findUnique({
    where: { id: payrunId },
    include: { structure: { include: { rules: true } } },
  })
  if (!payrun) throw new PayrunError("NOT_FOUND", "That payrun no longer exists.")
  if (payrun.status === PayrunStatus.PAID) {
    throw new PayrunError("ALREADY_PAID", "A paid payrun is historical and cannot be recomputed.")
  }

  const payslips = await db.payslip.findMany({
    where: { payrunId },
    select: { id: true, employeeId: true },
  })
  if (payslips.length === 0) {
    throw new PayrunError("NO_ELIGIBLE_EMPLOYEES", "This payrun has no payslips to compute.")
  }

  const employeeIds = payslips.map((p) => p.employeeId)

  // Batch-load once for the whole run — four queries, not four per employee.
  const [employees, contracts, attendance, leave] = await Promise.all([
    db.employee.findMany({
      where: { id: { in: employeeIds } },
      select: {
        id: true,
        workingSchedule: { select: { lines: true, hoursPerWeek: true } },
      },
    }),
    db.contract.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: ContractStatus.RUNNING,
        startDate: { lte: payrun.periodEnd },
        OR: [{ endDate: null }, { endDate: { gte: payrun.periodStart } }],
      },
      orderBy: { startDate: "desc" },
      include: { workingSchedule: { select: { lines: true, hoursPerWeek: true } } },
    }),
    db.attendance.findMany({
      where: {
        employeeId: { in: employeeIds },
        checkIn: { gte: payrun.periodStart, lte: payrun.periodEnd },
      },
      select: {
        employeeId: true,
        checkIn: true,
        workedHours: true,
        overtime: true,
        status: true,
      },
    }),
    db.timeOffRequest.findMany({
      where: {
        employeeId: { in: employeeIds },
        status: RequestStatus.APPROVED,
        startDate: { lte: payrun.periodEnd },
        endDate: { gte: payrun.periodStart },
      },
      select: {
        employeeId: true,
        startDate: true,
        endDate: true,
        duration: true,
        status: true,
        type: { select: { isPaid: true } },
      },
    }),
  ])

  const employeeById = new Map(employees.map((e) => [e.id, e]))
  // First match wins — ordered by startDate desc, and BR-C1 prevents overlaps.
  const contractByEmployee = new Map<string, (typeof contracts)[number]>()
  for (const c of contracts) {
    if (!contractByEmployee.has(c.employeeId)) contractByEmployee.set(c.employeeId, c)
  }
  const attendanceByEmployee = new Map<string, typeof attendance>()
  for (const a of attendance) {
    attendanceByEmployee.set(a.employeeId, [...(attendanceByEmployee.get(a.employeeId) ?? []), a])
  }
  const leaveByEmployee = new Map<string, typeof leave>()
  for (const l of leave) {
    leaveByEmployee.set(l.employeeId, [...(leaveByEmployee.get(l.employeeId) ?? []), l])
  }

  let computed = 0
  let skipped = 0

  for (const slip of payslips) {
    const employee = employeeById.get(slip.employeeId)
    const contract = contractByEmployee.get(slip.employeeId)

    // No applicable contract — the warning pass reports it. Skip rather than
    // write a zero payslip that would look legitimate.
    if (!employee || !contract) {
      skipped++
      continue
    }

    const schedule = contract.workingSchedule ?? employee.workingSchedule
    const ctx = buildContext({
      wage: contract.wage,
      periodStart: payrun.periodStart,
      periodEnd: payrun.periodEnd,
      scheduleDays: (schedule?.lines ?? []).map((l) => l.day as Weekday),
      hoursPerWeek: Number(schedule?.hoursPerWeek ?? 0),
      attendance: attendanceByEmployee.get(slip.employeeId) ?? [],
      leave: leaveByEmployee.get(slip.employeeId) ?? [],
    })

    const result = computePayslip(payrun.structure.rules, ctx)

    // Replace lines and roll-ups atomically — a payslip is never half-computed.
    await db.$transaction([
      db.payslipLine.deleteMany({ where: { payslipId: slip.id } }),
      db.payslip.update({
        where: { id: slip.id },
        data: {
          contractId: contract.id,
          workedDays: result.workedDays.toString(),
          basic: result.basic.toString(),
          allowances: result.allowances.toString(),
          gross: result.gross.toString(),
          deductions: result.deductions.toString(),
          net: result.net.toString(),
          status: PayslipStatus.COMPUTED,
          lines: {
            create: result.lines.map((l) => ({
              name: l.name,
              code: l.code,
              category: l.category,
              sequence: l.sequence,
              quantity: l.quantity.toString(),
              rate: l.rate,
              amount: l.amount.toString(),
              ruleId: l.ruleId,
            })),
          },
        },
      }),
    ])
    computed++
  }

  await db.payrun.update({
    where: { id: payrunId },
    data: { status: PayrunStatus.COMPUTED, computedAt: new Date() },
  })

  // Regenerate after computing so ZERO_NET sees real figures, and so a fixed
  // issue disappears rather than lingering from the previous run.
  const warnings = await regenerateWarnings(payrunId)

  return { computed, skipped, warnings: warnings.total, blocking: warnings.blocking }
}

export async function validatePayrunRecord(payrunId: string): Promise<void> {
  const payrun = await db.payrun.findUnique({
    where: { id: payrunId },
    select: { status: true },
  })
  if (!payrun) throw new PayrunError("NOT_FOUND", "That payrun no longer exists.")
  if (payrun.status === PayrunStatus.DRAFT) {
    throw new PayrunError("NOT_COMPUTED", "Compute the payrun before validating it.")
  }
  if (payrun.status === PayrunStatus.PAID) {
    throw new PayrunError("ALREADY_PAID", "This payrun is already paid.")
  }

  // AC-M8-4 — a blocking warning stops validation outright.
  const blocking = await blockingWarnings(payrunId)
  if (blocking.length > 0) {
    const first = blocking[0].message
    const rest = blocking.length > 1 ? ` (+${blocking.length - 1} more)` : ""
    throw new PayrunError(
      "BLOCKING_WARNINGS",
      `Resolve the blocking warnings before validating: ${first}${rest}`,
    )
  }

  await db.$transaction([
    db.payslip.updateMany({ where: { payrunId }, data: { status: PayslipStatus.VALIDATED } }),
    db.payrun.update({
      where: { id: payrunId },
      data: { status: PayrunStatus.VALIDATED, validatedAt: new Date() },
    }),
  ])
}

export async function markPayrunPaidRecord(payrunId: string): Promise<void> {
  const payrun = await db.payrun.findUnique({
    where: { id: payrunId },
    select: { status: true },
  })
  if (!payrun) throw new PayrunError("NOT_FOUND", "That payrun no longer exists.")
  if (payrun.status !== PayrunStatus.VALIDATED) {
    throw new PayrunError("NOT_VALIDATED", "Validate the payrun before marking it paid.")
  }

  await db.$transaction([
    db.payslip.updateMany({ where: { payrunId }, data: { status: PayslipStatus.PAID } }),
    db.payrun.update({
      where: { id: payrunId },
      data: { status: PayrunStatus.PAID, paidAt: new Date() },
    }),
  ])
}
