"use server"

import { ComputationType, Prisma, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { evaluateFormula } from "@/lib/payroll/evaluator"
import { DomainError, ok, toActionResult, type ActionResult } from "@/lib/result"
import { ruleSchema, structureSchema } from "@/lib/validation/payroll"

const revalidateSalary = () => {
  revalidatePath("/payroll/structures")
  revalidatePath("/payroll/rules")
}

export async function saveStructure(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    // Read-only for HR_PAYROLL_USER; editing needs manager rank (PRD §2.2).
    const actor = await requireRole(Role.HR_PAYROLL_MANAGER)
    const input = structureSchema.parse(raw)

    const structure = input.id
      ? await db.salaryStructure.update({
          where: { id: input.id },
          data: { name: input.name, active: input.active, note: input.note },
          select: { id: true },
        })
      : await db.salaryStructure.create({
          data: {
            name: input.name,
            active: input.active,
            note: input.note,
            companyId: actor.companyId,
          },
          select: { id: true },
        })

    revalidateSalary()
    return ok(structure)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return toActionResult(
        new DomainError("NAME_TAKEN", "A structure with that name already exists.", {
          name: "Name already in use.",
        }),
        "saveStructure",
      )
    }
    return toActionResult(error, "saveStructure")
  }
}

export async function saveRule(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole(Role.HR_PAYROLL_MANAGER)
    const input = ruleSchema.parse(raw)

    // Validate a formula at save time so a broken rule cannot reach compute
    // and blow up mid-payrun. Every code in the structure plus the context
    // facts is in scope.
    if (input.computationType === ComputationType.FORMULA && input.formula) {
      const siblings = await db.salaryRule.findMany({
        where: { structureId: input.structureId, ...(input.id ? { id: { not: input.id } } : {}) },
        select: { code: true },
      })
      // A probe scope of 1s: parsing and identifier resolution are what matter
      // here, not the arithmetic result.
      const scope = Object.fromEntries(
        [
          ...siblings.map((s) => s.code),
          input.code,
          "wage",
          "scheduledDays",
          "workedDays",
          "absentDays",
          "paidLeaveDays",
          "unpaidLeaveDays",
          "workedHours",
          "overtimeHours",
          "hoursPerWeek",
          "hourlyRate",
          "perDayRate",
        ].map((k) => [k, new Prisma.Decimal(1)]),
      )
      // Throws SalaryRuleError naming the offending identifier if it cannot parse.
      evaluateFormula(input.formula, scope, input.name)
    }

    const data = {
      structureId: input.structureId,
      name: input.name,
      code: input.code,
      category: input.category,
      sequence: input.sequence,
      computationType: input.computationType,
      amount: input.amount,
      percentage: input.percentage,
      percentageBase: input.percentageBase,
      baseRuleCode: input.baseRuleCode,
      formula: input.formula,
      quantity: input.quantity,
      condition: input.condition,
      active: input.active,
    }

    const rule = input.id
      ? await db.salaryRule.update({ where: { id: input.id }, data, select: { id: true } })
      : await db.salaryRule.create({ data, select: { id: true } })

    revalidateSalary()
    revalidatePath(`/payroll/structures/${input.structureId}`)
    return ok(rule)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return toActionResult(
        new DomainError("CODE_TAKEN", "That code is already used in this structure.", {
          code: "Code already used in this structure.",
        }),
        "saveRule",
      )
    }
    return toActionResult(error, "saveRule")
  }
}

export async function deleteRule(ruleId: string): Promise<ActionResult<void>> {
  try {
    await requireRole(Role.HR_PAYROLL_MANAGER)

    const used = await db.payslipLine.count({ where: { ruleId } })
    if (used > 0) {
      throw new DomainError(
        "RULE_IN_USE",
        `This rule appears on ${used} payslip line${used === 1 ? "" : "s"}. Deactivate it instead so historical payslips stay intact.`,
      )
    }

    await db.salaryRule.delete({ where: { id: ruleId } })
    revalidateSalary()
    return ok(undefined)
  } catch (error) {
    return toActionResult(error, "deleteRule")
  }
}
