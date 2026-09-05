"use server"

import { ContractStatus, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtDate } from "@/lib/dates"
import { findOverlappingRunningContract } from "@/lib/payroll/contract-resolver"
import { ContractError, ok, toActionResult, type ActionResult } from "@/lib/result"
import { contractSchema } from "@/lib/validation/contract"

/** CON/2026/0042 — sequential within the start date's year. */
async function nextReference(year: number): Promise<string> {
  const prefix = `CON/${year}/`
  const last = await db.contract.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  })
  const n = last ? Number(last.reference.split("/")[2]) + 1 : 1
  return `${prefix}${String(n).padStart(4, "0")}`
}

/**
 * BR-C1 — reject a RUNNING contract overlapping another RUNNING one, naming
 * the conflict so the user can act on it (AC-M2-1).
 */
async function assertNoOverlap(
  employeeId: string,
  startDate: Date,
  endDate: Date | null,
  status: ContractStatus,
  excludeId?: string,
) {
  if (status !== ContractStatus.RUNNING) return

  const clash = await findOverlappingRunningContract(
    employeeId,
    startDate,
    endDate,
    excludeId,
  )
  if (!clash) return

  const range = `${fmtDate(clash.startDate)} → ${
    clash.endDate ? fmtDate(clash.endDate) : "open-ended"
  }`
  throw new ContractError(
    "OVERLAPPING_CONTRACT",
    `Overlapping running contract: ${clash.reference} (${range}). An employee cannot hold two running contracts for the same period.`,
    { startDate: `Conflicts with ${clash.reference} (${range}).` },
  )
}

export async function createContract(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole(Role.HR_MANAGER)
    const input = contractSchema.parse(raw)

    await assertNoOverlap(input.employeeId, input.startDate, input.endDate, input.status)

    const contract = await db.contract.create({
      data: {
        reference: await nextReference(input.startDate.getFullYear()),
        employeeId: input.employeeId,
        startDate: input.startDate,
        endDate: input.endDate,
        wage: input.wage,
        status: input.status,
        departmentId: input.departmentId,
        jobPositionId: input.jobPositionId,
        workingScheduleId: input.workingScheduleId,
        salaryStructureId: input.salaryStructureId,
        notes: input.notes,
      },
      select: { id: true },
    })

    revalidatePath("/contracts")
    revalidatePath(`/employees/${input.employeeId}`)
    return ok(contract)
  } catch (error) {
    return toActionResult(error, "createContract")
  }
}

export async function updateContract(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole(Role.HR_MANAGER)
    const input = contractSchema.parse(raw)
    if (!input.id) throw new ContractError("MISSING_ID", "Contract id is required.")

    const existing = await db.contract.findUnique({
      where: { id: input.id },
      select: { id: true, employeeId: true },
    })
    if (!existing) throw new ContractError("NOT_FOUND", "That contract no longer exists.")

    await assertNoOverlap(
      input.employeeId,
      input.startDate,
      input.endDate,
      input.status,
      input.id,
    )

    const contract = await db.contract.update({
      where: { id: input.id },
      data: {
        employeeId: input.employeeId,
        startDate: input.startDate,
        endDate: input.endDate,
        wage: input.wage,
        status: input.status,
        departmentId: input.departmentId,
        jobPositionId: input.jobPositionId,
        workingScheduleId: input.workingScheduleId,
        salaryStructureId: input.salaryStructureId,
        notes: input.notes,
      },
      select: { id: true },
    })

    revalidatePath("/contracts")
    revalidatePath(`/contracts/${contract.id}`)
    revalidatePath(`/employees/${input.employeeId}`)
    return ok(contract)
  } catch (error) {
    return toActionResult(error, "updateContract")
  }
}
