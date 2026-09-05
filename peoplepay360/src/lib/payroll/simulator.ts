import { ContractStatus, Prisma, RequestStatus, RuleCategory, Weekday } from "@prisma/client"
import { db } from "@/lib/db"
import { buildContext, computePayslip, type ComputeContext } from "@/lib/payroll/engine"
import { PayrunError } from "@/lib/result"
import type { SimulationInput } from "@/lib/validation/simulator"

/**
 * The what-if simulator.
 *
 * It does not have a payroll engine of its own — it calls the *same*
 * `buildContext` + `computePayslip` a real payrun calls, with the facts nudged.
 * That is the whole point: with every override left blank it reproduces the
 * stored payslip to the paisa, which is what makes a changed number
 * trustworthy. Nothing here writes; there is no `db.$transaction`, no
 * `create`, no `update` in this file, and `check-simulator.ts` proves it by
 * comparing the database before and after.
 */

const D = Prisma.Decimal

export interface SimulatorOptions {
  employees: Array<{ id: string; name: string; employeeCode: string; department: string | null }>
  structures: Array<{ id: string; name: string }>
  periods: Array<{ label: string; start: string; end: string }>
  /**
   * An opening scenario that is a real baseline: an employee, period and
   * structure that produced an actual payslip. Defaulting to the first of each
   * list instead would open on, say, Contractor rules compared against a
   * Regular Salary payslip — every line would show a large delta that means
   * nothing, and the "reproduces the stored payslip" claim would not be on
   * screen where it matters.
   */
  defaults: { employeeId: string; structureId: string; period: string }
}

export interface SimLine {
  name: string
  code: string
  category: RuleCategory
  sequence: number
  rate: string
  /** Null when the line exists on only one side of the comparison. */
  actual: string | null
  simulated: string | null
  delta: string | null
}

export interface SimTotals {
  basic: string
  allowances: string
  gross: string
  deductions: string
  net: string
}

export interface SimulationResult {
  employeeName: string
  /** The contract the period resolves to — BR-C2, same rule the payrun uses. */
  contract: { reference: string; wage: string; startDate: string } | null
  structureName: string
  periodLabel: string
  /** Facts actually fed to the engine, after overrides. */
  facts: Record<string, string>
  /** Which facts the user moved, for the "you changed" summary. */
  changed: Array<{ label: string; from: string; to: string }>
  lines: SimLine[]
  simulated: SimTotals
  /** Present only when a computed payslip already exists for this period. */
  actual: (SimTotals & { reference: string }) | null
  deltas: SimTotals | null
  /** True when no override moved a single number away from the stored payslip. */
  matchesStored: boolean
}

/** Dropdown data for the simulator page. */
export async function loadSimulatorOptions(companyId: string): Promise<SimulatorOptions> {
  const [employees, structures, payruns] = await Promise.all([
    db.employee.findMany({
      where: { active: true, companyId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        department: { select: { name: true } },
      },
      orderBy: { firstName: "asc" },
    }),
    db.salaryStructure.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Offer the periods payroll has actually run, newest first — a simulation
    // against a period with no payslip has nothing to compare to.
    db.payrun.findMany({
      select: { name: true, periodStart: true, periodEnd: true },
      orderBy: { periodStart: "desc" },
      distinct: ["periodStart"],
      take: 12,
    }),
  ])

  const periods = payruns.map((p) => ({
    label: p.name,
    start: p.periodStart.toISOString().slice(0, 10),
    end: p.periodEnd.toISOString().slice(0, 10),
  }))

  // The newest computed payslip is by definition a scenario that has a real
  // counterpart to compare against.
  const seed = await db.payslip.findFirst({
    where: { contractId: { not: null }, employee: { companyId, active: true } },
    orderBy: [{ periodStart: "desc" }, { reference: "asc" }],
    select: {
      employeeId: true,
      periodStart: true,
      periodEnd: true,
      payrun: { select: { structureId: true } },
    },
  })

  return {
    employees: employees.map((e) => ({
      id: e.id,
      name: `${e.firstName} ${e.lastName}`,
      employeeCode: e.employeeCode,
      department: e.department?.name ?? null,
    })),
    structures,
    periods,
    defaults: {
      employeeId: seed?.employeeId ?? employees[0]?.id ?? "",
      structureId: seed?.payrun.structureId ?? structures[0]?.id ?? "",
      period: seed
        ? `${seed.periodStart.toISOString().slice(0, 10)}|${seed.periodEnd
            .toISOString()
            .slice(0, 10)}`
        : periods[0]
          ? `${periods[0].start}|${periods[0].end}`
          : "",
    },
  }
}

/**
 * Rebuild the derived rates after an override.
 *
 * `hourlyRate` and `perDayRate` are functions of wage and scheduled days, so
 * overriding either without recomputing them would leave the context
 * internally inconsistent — a formula reading `perDayRate` would silently use
 * the old wage.
 */
function withOverrides(
  base: ComputeContext,
  overrides: {
    wage?: Prisma.Decimal
    workedDays?: Prisma.Decimal
    overtimeHours?: Prisma.Decimal
    unpaidLeaveDays?: Prisma.Decimal
  },
): ComputeContext {
  const wage = overrides.wage ?? base.wage
  const next: ComputeContext = {
    ...base,
    wage,
    workedDays: overrides.workedDays ?? base.workedDays,
    overtimeHours: overrides.overtimeHours ?? base.overtimeHours,
    unpaidLeaveDays: overrides.unpaidLeaveDays ?? base.unpaidLeaveDays,
  }

  const monthlyHours = next.hoursPerWeek.times(52).div(12)
  next.hourlyRate = monthlyHours.gt(0)
    ? wage.div(monthlyHours).toDecimalPlaces(4)
    : new D(0)
  next.perDayRate = next.scheduledDays.gt(0)
    ? wage.div(next.scheduledDays).toDecimalPlaces(4)
    : new D(0)

  return next
}

const FACT_LABELS: Array<[keyof ComputeContext, string]> = [
  ["wage", "Contract wage"],
  ["scheduledDays", "Scheduled days"],
  ["workedDays", "Worked days"],
  ["absentDays", "Absent days"],
  ["paidLeaveDays", "Paid leave days"],
  ["unpaidLeaveDays", "Unpaid leave days"],
  ["workedHours", "Worked hours"],
  ["overtimeHours", "Overtime hours"],
  ["hoursPerWeek", "Hours per week"],
  ["hourlyRate", "Hourly rate"],
  ["perDayRate", "Per-day rate"],
]

export async function simulate(input: SimulationInput): Promise<SimulationResult> {
  const employee = await db.employee.findUnique({
    where: { id: input.employeeId },
    select: {
      firstName: true,
      lastName: true,
      workingSchedule: { select: { lines: true, hoursPerWeek: true } },
    },
  })
  if (!employee) throw new PayrunError("NOT_FOUND", "That employee no longer exists.")

  // BR-C2 — the contract that covers the period, not simply the newest.
  const contract = await db.contract.findFirst({
    where: {
      employeeId: input.employeeId,
      status: ContractStatus.RUNNING,
      startDate: { lte: input.periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: input.periodStart } }],
    },
    orderBy: { startDate: "desc" },
    include: { workingSchedule: { select: { lines: true, hoursPerWeek: true } } },
  })
  if (!contract) {
    throw new PayrunError(
      "NO_CONTRACT",
      "This employee has no running contract covering that period, so there is nothing to compute.",
    )
  }

  const structure = await db.salaryStructure.findUnique({
    where: { id: input.structureId },
    include: { rules: true },
  })
  if (!structure) {
    throw new PayrunError("NO_STRUCTURE", "That salary structure no longer exists.")
  }

  const [attendance, leave] = await Promise.all([
    db.attendance.findMany({
      where: {
        employeeId: input.employeeId,
        checkIn: { gte: input.periodStart, lte: input.periodEnd },
      },
      select: { checkIn: true, workedHours: true, overtime: true, status: true },
    }),
    db.timeOffRequest.findMany({
      where: {
        employeeId: input.employeeId,
        status: RequestStatus.APPROVED,
        startDate: { lte: input.periodEnd },
        endDate: { gte: input.periodStart },
      },
      select: {
        startDate: true,
        endDate: true,
        duration: true,
        status: true,
        type: { select: { isPaid: true } },
      },
    }),
  ])

  const schedule = contract.workingSchedule ?? employee.workingSchedule

  // The unmodified truth — identical to what computePayrunSlips would build.
  const baseline = buildContext({
    wage: contract.wage,
    periodStart: input.periodStart,
    periodEnd: input.periodEnd,
    scheduleDays: (schedule?.lines ?? []).map((l) => l.day as Weekday),
    hoursPerWeek: Number(schedule?.hoursPerWeek ?? 0),
    attendance,
    leave,
  })

  const ctx = withOverrides(baseline, {
    wage: input.wage === null ? undefined : new D(input.wage),
    workedDays: input.workedDays === null ? undefined : new D(input.workedDays),
    overtimeHours: input.overtimeHours === null ? undefined : new D(input.overtimeHours),
    unpaidLeaveDays:
      input.unpaidLeaveDays === null ? undefined : new D(input.unpaidLeaveDays),
  })

  const changed = FACT_LABELS.filter(([key]) => !ctx[key].equals(baseline[key])).map(
    ([key, label]) => ({
      label,
      from: baseline[key].toString(),
      to: ctx[key].toString(),
    }),
  )

  const result = computePayslip(structure.rules, ctx)

  // The stored payslip for the same employee and period, if payroll ran it.
  const stored = await db.payslip.findFirst({
    where: {
      employeeId: input.employeeId,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    },
    select: {
      reference: true,
      basic: true,
      allowances: true,
      gross: true,
      deductions: true,
      net: true,
      lines: { orderBy: { sequence: "asc" } },
    },
  })

  const storedLines = new Map((stored?.lines ?? []).map((l) => [l.code, l]))
  const simulatedLines = new Map(result.lines.map((l) => [l.code, l]))

  const codes = [...new Set([...storedLines.keys(), ...simulatedLines.keys()])]
  const lines: SimLine[] = codes
    .map((code) => {
      const a = storedLines.get(code)
      const s = simulatedLines.get(code)
      const actual = a ? new D(a.amount) : null
      const simulated = s ? s.amount : null
      return {
        name: s?.name ?? a?.name ?? code,
        code,
        category: (s?.category ?? a?.category ?? RuleCategory.ALLOWANCE) as RuleCategory,
        sequence: s?.sequence ?? a?.sequence ?? 0,
        rate: s?.rate ?? a?.rate ?? "",
        actual: actual ? actual.toFixed(2) : null,
        simulated: simulated ? simulated.toFixed(2) : null,
        delta:
          actual && simulated ? simulated.minus(actual).toFixed(2) : null,
      }
    })
    .sort((x, y) => x.sequence - y.sequence)

  const simulated: SimTotals = {
    basic: result.basic.toFixed(2),
    allowances: result.allowances.toFixed(2),
    gross: result.gross.toFixed(2),
    deductions: result.deductions.toFixed(2),
    net: result.net.toFixed(2),
  }

  const actual = stored
    ? {
        reference: stored.reference,
        basic: new D(stored.basic).toFixed(2),
        allowances: new D(stored.allowances).toFixed(2),
        gross: new D(stored.gross).toFixed(2),
        deductions: new D(stored.deductions).toFixed(2),
        net: new D(stored.net).toFixed(2),
      }
    : null

  const deltas = actual
    ? {
        basic: new D(simulated.basic).minus(actual.basic).toFixed(2),
        allowances: new D(simulated.allowances).minus(actual.allowances).toFixed(2),
        gross: new D(simulated.gross).minus(actual.gross).toFixed(2),
        deductions: new D(simulated.deductions).minus(actual.deductions).toFixed(2),
        net: new D(simulated.net).minus(actual.net).toFixed(2),
      }
    : null

  return {
    employeeName: `${employee.firstName} ${employee.lastName}`,
    contract: {
      reference: contract.reference,
      wage: new D(contract.wage).toFixed(2),
      startDate: contract.startDate.toISOString().slice(0, 10),
    },
    structureName: structure.name,
    periodLabel: `${input.periodStart.toISOString().slice(0, 10)} → ${input.periodEnd
      .toISOString()
      .slice(0, 10)}`,
    facts: Object.fromEntries(FACT_LABELS.map(([key, label]) => [label, ctx[key].toString()])),
    changed,
    lines,
    simulated,
    actual,
    deltas,
    matchesStored: deltas !== null && Object.values(deltas).every((d) => Number(d) === 0),
  }
}
