import { ComputationType, PercentageBase, RuleCategory } from "@prisma/client"
import { formatINR, formatPercent } from "@/lib/money"

/** The columns of a SalaryRule that say *how* it computes. */
export interface RuleShape {
  computationType: ComputationType
  amount: unknown
  percentage: unknown
  percentageBase: PercentageBase | null
  baseRuleCode: string | null
  formula: string | null
}

const BASE_CODE: Record<PercentageBase, string> = {
  CONTRACT_WAGE: "wage",
  BASIC: "BASIC",
  GROSS: "GROSS",
  RULE_CODE: "",
}

const isBlank = (v: unknown) => v === null || v === undefined || v === ""

/**
 * The rule's working as one mono expression: "20% × BASIC", "₹3,000.00 fixed",
 * "BASIC + HRA + STD". Pure formatting of stored columns — nothing here is
 * evaluated; the interpreter in lib/payroll/evaluator.ts owns that.
 */
export function ruleExpression(r: RuleShape): string {
  switch (r.computationType) {
    case ComputationType.FIXED:
      return isBlank(r.amount) ? "fixed" : `${formatINR(String(r.amount))} fixed`
    case ComputationType.PERCENTAGE: {
      const base =
        r.percentageBase === PercentageBase.RULE_CODE
          ? (r.baseRuleCode ?? "?")
          : BASE_CODE[r.percentageBase ?? PercentageBase.CONTRACT_WAGE]
      const pct = isBlank(r.percentage) ? "?%" : formatPercent(String(r.percentage))
      return `${pct} × ${base}`
    }
    case ComputationType.FORMULA:
      return r.formula?.trim() || "formula"
    default:
      return "—"
  }
}

/** Ring-style chip per category — one place, so ledger, cards and lists agree. */
export const CATEGORY_CHIP: Record<RuleCategory, string> = {
  BASIC: "bg-primary-subtle text-primary ring-primary/20",
  ALLOWANCE: "bg-success-subtle text-success ring-success/20",
  GROSS: "bg-info-subtle text-info ring-info/20",
  DEDUCTION: "bg-danger-subtle text-danger ring-danger/20",
  NET: "bg-primary-subtle text-primary ring-primary/20",
}

/** Solid tone for rails and dots. */
export const CATEGORY_RAIL: Record<RuleCategory, string> = {
  BASIC: "bg-primary",
  ALLOWANCE: "bg-success",
  GROSS: "bg-info",
  DEDUCTION: "bg-danger",
  NET: "bg-primary",
}
