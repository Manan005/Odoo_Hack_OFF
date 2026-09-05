"use server"

import { PayrunStatus, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import {
  computePayrunSlips,
  createPayrunWithPayslips,
  findEligibleEmployees,
  markPayrunPaidRecord,
  validatePayrunRecord,
  type EligibleEmployee,
} from "@/lib/payroll/payrun-service"
import { PayrunError, ok, toActionResult, type ActionResult } from "@/lib/result"
import { createPayrunSchema, payrunScopeSchema } from "@/lib/validation/payroll"

export type { EligibleEmployee }

/**
 * These actions are the security boundary: guard, validate, delegate to
 * lib/payroll/payrun-service.ts, revalidate. No business logic here.
 */

export async function listEligibleEmployees(
  raw: unknown,
): Promise<ActionResult<EligibleEmployee[]>> {
  try {
    const actor = await requireRole(Role.HR_PAYROLL_USER)
    const scope = payrunScopeSchema.parse(raw)
    // Read-only — this is what guarantees the wizard writes nothing (AC-M8-1).
    return ok(await findEligibleEmployees(actor.companyId, scope))
  } catch (error) {
    return toActionResult(error, "listEligibleEmployees")
  }
}

/** The only wizard call that writes — "Create Payrun". */
export async function createPayrun(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_PAYROLL_USER)
    const input = createPayrunSchema.parse(raw)
    const payrun = await createPayrunWithPayslips(actor.companyId, input)

    revalidatePath("/payroll/payruns")
    return ok(payrun)
  } catch (error) {
    return toActionResult(error, "createPayrun")
  }
}

export async function computePayrun(
  payrunId: string,
): Promise<ActionResult<{ computed: number; skipped: number }>> {
  try {
    await requireRole(Role.HR_PAYROLL_USER)
    const result = await computePayrunSlips(payrunId)

    revalidatePath(`/payroll/payruns/${payrunId}`)
    revalidatePath("/payroll/payslips")
    return ok(result)
  } catch (error) {
    return toActionResult(error, "computePayrun")
  }
}

export async function validatePayrun(payrunId: string): Promise<ActionResult<void>> {
  try {
    await requireRole(Role.HR_PAYROLL_USER)
    await validatePayrunRecord(payrunId)

    revalidatePath(`/payroll/payruns/${payrunId}`)
    return ok(undefined)
  } catch (error) {
    return toActionResult(error, "validatePayrun")
  }
}

export async function markPayrunPaid(payrunId: string): Promise<ActionResult<void>> {
  try {
    await requireRole(Role.HR_PAYROLL_USER)
    await markPayrunPaidRecord(payrunId)

    revalidatePath(`/payroll/payruns/${payrunId}`)
    revalidatePath("/payroll/dashboard")
    return ok(undefined)
  } catch (error) {
    return toActionResult(error, "markPayrunPaid")
  }
}

export async function deletePayrun(payrunId: string): Promise<ActionResult<void>> {
  try {
    await requireRole(Role.HR_PAYROLL_MANAGER)

    const payrun = await db.payrun.findUnique({
      where: { id: payrunId },
      select: { status: true },
    })
    if (!payrun) throw new PayrunError("NOT_FOUND", "That payrun no longer exists.")
    if (payrun.status === PayrunStatus.PAID) {
      throw new PayrunError(
        "ALREADY_PAID",
        "Paid payroll is kept as historical data and cannot be deleted.",
      )
    }

    await db.payrun.delete({ where: { id: payrunId } })
    revalidatePath("/payroll/payruns")
    return ok(undefined)
  } catch (error) {
    return toActionResult(error, "deletePayrun")
  }
}

/** Recompute the payrun a single payslip belongs to. */
export async function computeSinglePayslip(
  payslipId: string,
): Promise<ActionResult<{ net: string }>> {
  try {
    await requireRole(Role.HR_PAYROLL_USER)

    const slip = await db.payslip.findUnique({
      where: { id: payslipId },
      select: { payrunId: true },
    })
    if (!slip) throw new PayrunError("NOT_FOUND", "That payslip no longer exists.")

    await computePayrunSlips(slip.payrunId)

    const updated = await db.payslip.findUnique({
      where: { id: payslipId },
      select: { net: true },
    })

    revalidatePath(`/payroll/payslips/${payslipId}`)
    revalidatePath(`/payroll/payruns/${slip.payrunId}`)
    return ok({ net: String(updated?.net ?? 0) })
  } catch (error) {
    return toActionResult(error, "computeSinglePayslip")
  }
}
