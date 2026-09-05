import {
  ComputationType,
  PercentageBase,
  Prisma,
  RuleCategory,
  type SalaryRule,
  Weekday,
} from "@prisma/client"
import { formatINR } from "@/lib/money"
import { evaluateCondition, evaluateFormula, type Scope } from "@/lib/payroll/evaluator"
import { buildPeriodFacts, type AttendanceLike, type LeaveLike } from "@/lib/payroll/worked-days"
import { SalaryRuleError } from "@/lib/result"

const D = Prisma.Decimal

/** Facts every formula can read, alongside the rule codes computed so far. */
export interface ComputeContext {
  wage: Prisma.Decimal
  scheduledDays: Prisma.Decimal
  workedDays: Prisma.Decimal
  absentDays: Prisma.Decimal
  paidLeaveDays: Prisma.Decimal
  unpaidLeaveDays: Prisma.Decimal
  workedHours: Prisma.Decimal
  overtimeHours: Prisma.Decimal
  hoursPerWeek: Prisma.Decimal
  hourlyRate: Prisma.Decimal
  perDayRate: Prisma.Decimal
}

export interface ComputedLine {
  name: string
  code: string
  category: RuleCategory
  sequence: number
  quantity: Prisma.Decimal
  rate: string
  amount: Prisma.Decimal
  ruleId: string
}

export interface ComputedPayslip {
  lines: ComputedLine[]
  basic: Prisma.Decimal
  allowances: Prisma.Decimal
  gross: Prisma.Decimal
  deductions: Prisma.Decimal
  net: Prisma.Decimal
  workedDays: Prisma.Decimal
  facts: ComputeContext
}

export function buildContext({
  wage,
  periodStart,
  periodEnd,
  scheduleDays,
  hoursPerWeek,
  attendance,
  leave,
}: {
  wage: Prisma.Decimal | string | number
  periodStart: Date
  periodEnd: Date
  scheduleDays: Weekday[]
  hoursPerWeek: number
  attendance: AttendanceLike[]
  leave: LeaveLike[]
}): ComputeContext {
  const facts = buildPeriodFacts({
    periodStart,
    periodEnd,
    scheduleDays,
    hoursPerWeek,
    attendance,
    leave,
  })

  const wageDec = new D(wage)

  // Monthly hours ≈ weekly × 52 ÷ 12. Guarded so a schedule-less employee
  // cannot divide by zero.
  const monthlyHours = facts.hoursPerWeek > 0 ? (facts.hoursPerWeek * 52) / 12 : 0
  const hourlyRate = monthlyHours > 0 ? wageDec.div(monthlyHours) : new D(0)
  const perDayRate =
    facts.scheduledDays > 0 ? wageDec.div(facts.scheduledDays) : new D(0)

  return {
    wage: wageDec,
    scheduledDays: new D(facts.scheduledDays),
    workedDays: new D(facts.workedDays),
    absentDays: new D(facts.absentDays),
    paidLeaveDays: new D(facts.paidLeaveDays),
    unpaidLeaveDays: new D(facts.unpaidLeaveDays),
    workedHours: new D(facts.workedHours),
    overtimeHours: new D(facts.overtimeHours),
    hoursPerWeek: new D(facts.hoursPerWeek),
    hourlyRate: hourlyRate.toDecimalPlaces(4),
    perDayRate: perDayRate.toDecimalPlaces(4),
  }
}

/** Context facts plus every rule code computed so far, for the interpreter. */
const scopeFrom = (ctx: ComputeContext, rules: Record<string, Prisma.Decimal>): Scope => ({
  ...ctx,
  ...rules,
})

function resolveBase(
  rule: SalaryRule,
  ctx: ComputeContext,
  computed: Record<string, Prisma.Decimal>,
): { value: Prisma.Decimal; label: string } {
  switch (rule.percentageBase) {
    case PercentageBase.CONTRACT_WAGE:
      return { value: ctx.wage, label: "wage" }
    case PercentageBase.BASIC:
    case PercentageBase.GROSS:
    case PercentageBase.RULE_CODE: {
      const code =
        rule.percentageBase === PercentageBase.RULE_CODE
          ? (rule.baseRuleCode ?? "")
          : rule.percentageBase
      const value = computed[code]
      if (value === undefined) {
        throw new SalaryRuleError(
          "MISSING_BASE_RULE",
          `Rule "${rule.name}" is a percentage of "${code}", but that rule has not been computed yet. Give it a lower sequence number.`,
        )
      }
      return { value, label: code }
    }
    default:
      return { value: ctx.wage, label: "wage" }
  }
}

/**
 * Run a structure's rules in ascending sequence against one employee's facts.
 *
 * Order is the contract: each rule writes its result into the scope, so later
 * rules such as GROSS and NET can be plain formulas over earlier codes. This
 * is what makes salary rules genuinely drive the payslip (rules.md §0).
 */
export function computePayslip(rules: SalaryRule[], ctx: ComputeContext): ComputedPayslip {
  const ordered = [...rules]
    .filter((r) => r.active)
    .sort((a, b) => a.sequence - b.sequence)

  const computed: Record<string, Prisma.Decimal> = {}
  const lines: ComputedLine[] = []

  for (const rule of ordered) {
    // An optional condition gates the rule entirely.
    if (rule.condition?.trim()) {
      const applies = evaluateCondition(
        rule.condition,
        scopeFrom(ctx, computed),
        rule.name,
      )
      if (!applies) continue
    }

    let amount: Prisma.Decimal
    let rate: string

    switch (rule.computationType) {
      case ComputationType.FIXED: {
        if (rule.amount === null) {
          throw new SalaryRuleError(
            "INVALID_FORMULA",
            `Rule "${rule.name}" is a fixed amount but has no amount set.`,
          )
        }
        amount = new D(rule.amount)
        rate = "fixed"
        break
      }

      case ComputationType.PERCENTAGE: {
        if (rule.percentage === null) {
          throw new SalaryRuleError(
            "INVALID_FORMULA",
            `Rule "${rule.name}" is a percentage but has no percentage set.`,
          )
        }
        const pct = new D(rule.percentage)
        const base = resolveBase(rule, ctx, computed)
        amount = base.value.times(pct).div(100)
        rate = `${pct.toString()}% × ${base.label}`
        break
      }

      case ComputationType.FORMULA: {
        if (!rule.formula?.trim()) {
          throw new SalaryRuleError(
            "INVALID_FORMULA",
            `Rule "${rule.name}" is a formula but has no formula set.`,
          )
        }
        amount = evaluateFormula(rule.formula, scopeFrom(ctx, computed), rule.name)
        rate = "formula"
        break
      }

      default:
        throw new SalaryRuleError(
          "INVALID_FORMULA",
          `Rule "${rule.name}" has an unknown computation type.`,
        )
    }

    const quantity = new D(rule.quantity)
    amount = amount.times(quantity).toDecimalPlaces(2)

    // Deductions are stored as positive magnitudes and rendered negative, so a
    // rule author writing "12% of BASIC" gets what they expect either way.
    if (rule.category === RuleCategory.DEDUCTION) amount = amount.abs()

    computed[rule.code] = amount
    lines.push({
      name: rule.name,
      code: rule.code,
      category: rule.category,
      sequence: rule.sequence,
      quantity,
      rate: quantity.equals(1) ? rate : `${rate} × ${quantity.toString()}`,
      amount,
      ruleId: rule.id,
    })
  }

  const sumOf = (category: RuleCategory) =>
    lines
      .filter((l) => l.category === category)
      .reduce<Prisma.Decimal>((sum, l) => sum.plus(l.amount), new D(0))

  const basic = sumOf(RuleCategory.BASIC)
  const allowances = sumOf(RuleCategory.ALLOWANCE)
  const deductions = sumOf(RuleCategory.DEDUCTION)

  // Prefer the rule-computed GROSS/NET — the whole point is that rules drive
  // the numbers. The fallbacks only cover a structure that omits those codes.
  const grossLine = lines.find((l) => l.category === RuleCategory.GROSS)
  const netLine = lines.find((l) => l.category === RuleCategory.NET)

  const gross = grossLine ? grossLine.amount : basic.plus(allowances)
  const net = netLine ? netLine.amount : gross.minus(deductions)

  return {
    lines,
    basic: basic.toDecimalPlaces(2),
    allowances: allowances.toDecimalPlaces(2),
    gross: gross.toDecimalPlaces(2),
    deductions: deductions.toDecimalPlaces(2),
    net: net.toDecimalPlaces(2),
    workedDays: ctx.workedDays,
    facts: ctx,
  }
}

/** Human-readable summary for logs and the compute result toast. */
export const describePayslip = (p: ComputedPayslip): string =>
  `basic ${formatINR(p.basic)} · gross ${formatINR(p.gross)} · net ${formatINR(p.net)} across ${p.lines.length} lines`
