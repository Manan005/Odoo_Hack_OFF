import {
  ComputationType,
  EmployeeType,
  PercentageBase,
  RuleCategory,
} from "@prisma/client"
import { z } from "zod"

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()

const requiredDate = z
  .string()
  .trim()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Enter a valid date" })

// ───────────────────────── Salary structure ─────────────────────────

export const structureSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Structure name is required").max(60),
  active: z.boolean(),
  note: optionalText,
})

// ─────────────────────────── Salary rule ───────────────────────────

export const ruleSchema = z
  .object({
    id: z.string().optional(),
    structureId: z.string().min(1, "Select a salary structure"),
    name: z.string().trim().min(1, "Rule name is required").max(60),
    code: z
      .string()
      .trim()
      .min(1, "Code is required")
      .max(20)
      .regex(/^[A-Z][A-Z0-9_]*$/, "Use uppercase letters, digits and underscores, e.g. BASIC")
      // Reserved: these are context facts the interpreter already provides.
      .refine(
        (c) =>
          ![
            "WAGE",
            "WORKEDDAYS",
            "SCHEDULEDDAYS",
            "WORKEDHOURS",
            "OVERTIMEHOURS",
            "HOURLYRATE",
            "PERDAYRATE",
          ].includes(c),
        "That code is reserved by the calculation context",
      ),
    category: z.nativeEnum(RuleCategory),
    sequence: z.coerce.number().int().min(1, "Sequence must be 1 or more").max(9999),
    computationType: z.nativeEnum(ComputationType),
    amount: optionalText,
    percentage: optionalText,
    percentageBase: z.nativeEnum(PercentageBase).nullable(),
    baseRuleCode: optionalText,
    formula: optionalText,
    quantity: z
      .string()
      .trim()
      .default("1")
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a number like 1 or 1.5"),
    condition: optionalText,
    active: z.boolean(),
  })
  .superRefine((r, ctx) => {
    if (r.computationType === ComputationType.FIXED && !r.amount) {
      ctx.addIssue({ code: "custom", path: ["amount"], message: "Amount is required" })
    }
    if (r.computationType === ComputationType.PERCENTAGE) {
      if (!r.percentage) {
        ctx.addIssue({ code: "custom", path: ["percentage"], message: "Percentage is required" })
      }
      if (r.percentageBase === PercentageBase.RULE_CODE && !r.baseRuleCode) {
        ctx.addIssue({
          code: "custom",
          path: ["baseRuleCode"],
          message: "Name the rule code this is a percentage of",
        })
      }
    }
    if (r.computationType === ComputationType.FORMULA && !r.formula) {
      ctx.addIssue({ code: "custom", path: ["formula"], message: "Formula is required" })
    }
  })

// ───────────────────────────── Payrun ─────────────────────────────

/** Wizard step 1 — scope only. Deliberately creates nothing (AC-M8-1). */
export const payrunScopeSchema = z
  .object({
    name: optionalText,
    structureId: z.string().min(1, "Select a salary structure"),
    periodStart: requiredDate,
    periodEnd: requiredDate,
    employeeTypes: z.array(z.nativeEnum(EmployeeType)).default([]),
    departmentId: optionalId,
  })
  .refine((s) => s.periodEnd >= s.periodStart, {
    message: "Period end must be on or after the start",
    path: ["periodEnd"],
  })

/** Wizard step 2 — the only call that writes. */
export const createPayrunSchema = payrunScopeSchema.safeExtend({
  employeeIds: z.array(z.string()).min(1, "Select at least one employee"),
})

export type StructureInput = z.infer<typeof structureSchema>
export type RuleInput = z.infer<typeof ruleSchema>
export type PayrunScopeInput = z.infer<typeof payrunScopeSchema>
export type CreatePayrunInput = z.infer<typeof createPayrunSchema>

// ───────────────────────────── Labels ─────────────────────────────

export const CATEGORY_LABEL: Record<RuleCategory, string> = {
  BASIC: "Basic",
  ALLOWANCE: "Allowance",
  GROSS: "Gross",
  DEDUCTION: "Deduction",
  NET: "Net",
}

export const COMPUTATION_LABEL: Record<ComputationType, string> = {
  FIXED: "Fixed amount",
  PERCENTAGE: "Percentage of a base",
  FORMULA: "Formula",
}

export const BASE_LABEL: Record<PercentageBase, string> = {
  CONTRACT_WAGE: "Contract wage",
  BASIC: "Basic salary",
  GROSS: "Gross salary",
  RULE_CODE: "Another rule",
}
