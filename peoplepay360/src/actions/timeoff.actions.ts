"use server"

import { RequestStatus, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { ROLE_RANK, rankOf, requireAuth, requireRole } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import {
  approveRequest as approveRequestTx,
  assertCanRequest,
  computeDuration,
  releaseRequest as releaseRequestTx,
} from "@/lib/timeoff/balance"
import { TimeOffError, ok, toActionResult, type ActionResult } from "@/lib/result"
import {
  allocationSchema,
  requestSchema,
  timeOffTypeSchema,
} from "@/lib/validation/timeoff"

const revalidateTimeOff = () => {
  revalidatePath("/time-off/requests")
  revalidatePath("/time-off/allocations")
  revalidatePath("/time-off/types")
}

// ───────────────────────────── Time Off Types ─────────────────────────────

export async function saveTimeOffType(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_MANAGER)
    const input = timeOffTypeSchema.parse(raw)

    const data = {
      name: input.name,
      unit: input.unit,
      requiresAllocation: input.requiresAllocation,
      approvalMode: input.approvalMode,
      workEntryLabel: input.workEntryLabel,
      isPaid: input.isPaid,
      displayColor: input.displayColor,
      active: input.active,
      description: input.description,
    }

    const type = input.id
      ? await db.timeOffType.update({
          where: { id: input.id },
          data,
          select: { id: true },
        })
      : await db.timeOffType.create({
          data: { ...data, companyId: actor.companyId },
          select: { id: true },
        })

    revalidateTimeOff()
    return ok(type)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return toActionResult(
        new TimeOffError("NAME_TAKEN", "A time off type with that name already exists.", {
          name: "Name already in use.",
        }),
        "saveTimeOffType",
      )
    }
    return toActionResult(error, "saveTimeOffType")
  }
}

// ───────────────────────────── Allocations ─────────────────────────────

export async function saveAllocation(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole(Role.HR_MANAGER)
    const input = allocationSchema.parse(raw)

    const data = {
      employeeId: input.employeeId,
      typeId: input.typeId,
      allocated: input.allocated,
      validityLabel: input.validityLabel,
      description: input.description,
    }

    let allocation: { id: string }
    if (input.id) {
      const existing = await db.timeOffAllocation.findUnique({
        where: { id: input.id },
        select: { taken: true },
      })
      if (!existing) throw new TimeOffError("NOT_FOUND", "That allocation no longer exists.")

      // Never let an edit strand consumed days above the new grant.
      if (Number(input.allocated) < Number(existing.taken)) {
        throw new TimeOffError(
          "BELOW_TAKEN",
          `${existing.taken} already taken — the allocation cannot be reduced below that.`,
          { allocated: `Cannot be less than ${existing.taken} already taken.` },
        )
      }

      allocation = await db.timeOffAllocation.update({
        where: { id: input.id },
        data,
        select: { id: true },
      })
    } else {
      allocation = await db.timeOffAllocation.create({
        data: { ...data, status: RequestStatus.TO_APPROVE },
        select: { id: true },
      })
    }

    revalidateTimeOff()
    revalidatePath(`/employees/${input.employeeId}`)
    return ok(allocation)
  } catch (error) {
    return toActionResult(error, "saveAllocation")
  }
}

/** An approved allocation is what creates available balance. */
async function setAllocationStatus(
  allocationId: string,
  status: "APPROVED" | "REFUSED",
): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_MANAGER)

    const existing = await db.timeOffAllocation.findUnique({
      where: { id: allocationId },
      select: { taken: true, status: true },
    })
    if (!existing) throw new TimeOffError("NOT_FOUND", "That allocation no longer exists.")

    // Revoking a balance that requests have already drawn on would leave those
    // requests dangling — refuse rather than corrupt the ledger.
    if (status === RequestStatus.REFUSED && Number(existing.taken) > 0) {
      throw new TimeOffError(
        "ALLOCATION_IN_USE",
        `${existing.taken} already consumed by approved requests. Refuse those requests first.`,
      )
    }

    const allocation = await db.timeOffAllocation.update({
      where: { id: allocationId },
      data: { status, approverId: actor.employeeId },
      select: { id: true },
    })

    revalidateTimeOff()
    return ok(allocation)
  } catch (error) {
    return toActionResult(error, "setAllocationStatus")
  }
}

export async function approveAllocation(id: string): Promise<ActionResult<{ id: string }>> {
  return setAllocationStatus(id, RequestStatus.APPROVED)
}

export async function refuseAllocation(id: string): Promise<ActionResult<{ id: string }>> {
  return setAllocationStatus(id, RequestStatus.REFUSED)
}

// ───────────────────────────── Requests ─────────────────────────────

export async function saveRequest(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAuth()
    const input = requestSchema.parse(raw)

    const isHr = rankOf(actor.roles) >= ROLE_RANK.HR_MANAGER
    if (!isHr && input.employeeId !== actor.employeeId) {
      throw new TimeOffError("FORBIDDEN", "You can only request time off for yourself.")
    }

    const type = await db.timeOffType.findUnique({
      where: { id: input.typeId },
      select: { unit: true },
    })
    if (!type) throw new TimeOffError("TYPE_NOT_FOUND", "That time off type no longer exists.")

    // BR-T4 — duration comes from the schedule, never from the client.
    const duration = await computeDuration(
      input.employeeId,
      input.startDate,
      input.endDate,
      type.unit,
    )
    if (duration <= 0) {
      throw new TimeOffError(
        "NO_WORKING_DAYS",
        "That range contains no working days on this employee's schedule.",
        { endDate: "No working days in this range." },
      )
    }

    // BR-T1 — the allocation gate, before anything is written.
    const { allocationId } = await assertCanRequest(
      input.employeeId,
      input.typeId,
      duration,
      input.id,
    )

    const data = {
      employeeId: input.employeeId,
      typeId: input.typeId,
      startDate: input.startDate,
      endDate: input.endDate,
      duration,
      reason: input.reason,
      allocationId,
    }

    let request: { id: string }
    if (input.id) {
      const existing = await db.timeOffRequest.findUnique({
        where: { id: input.id },
        select: { status: true },
      })
      if (!existing) throw new TimeOffError("NOT_FOUND", "That request no longer exists.")
      if (existing.status === RequestStatus.APPROVED) {
        throw new TimeOffError(
          "ALREADY_APPROVED",
          "Refuse this request before editing it — its balance is already consumed.",
        )
      }
      request = await db.timeOffRequest.update({
        where: { id: input.id },
        data,
        select: { id: true },
      })
    } else {
      request = await db.timeOffRequest.create({
        data: { ...data, status: RequestStatus.TO_APPROVE },
        select: { id: true },
      })
    }

    revalidateTimeOff()
    revalidatePath(`/employees/${input.employeeId}`)
    return ok(request)
  } catch (error) {
    return toActionResult(error, "saveRequest")
  }
}

/** BR-T2 — approving consumes the linked allocation's balance. */
export async function approveRequest(requestId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_MANAGER)
    const request = await approveRequestTx(requestId, actor.employeeId)
    revalidateTimeOff()
    return ok(request)
  } catch (error) {
    return toActionResult(error, "approveRequest")
  }
}

/** BR-T2 — refusing an approved request releases the days back. */
export async function refuseRequest(requestId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_MANAGER)
    const request = await releaseRequestTx(requestId, RequestStatus.REFUSED, actor.employeeId)
    revalidateTimeOff()
    return ok(request)
  } catch (error) {
    return toActionResult(error, "refuseRequest")
  }
}

/** An employee may withdraw their own pending request. */
export async function cancelRequest(requestId: string): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAuth()
    const existing = await db.timeOffRequest.findUnique({
      where: { id: requestId },
      select: { employeeId: true },
    })
    if (!existing) throw new TimeOffError("NOT_FOUND", "That request no longer exists.")

    const isHr = rankOf(actor.roles) >= ROLE_RANK.HR_MANAGER
    if (!isHr && existing.employeeId !== actor.employeeId) {
      throw new TimeOffError("FORBIDDEN", "You can only cancel your own requests.")
    }

    const request = await releaseRequestTx(
      requestId,
      RequestStatus.CANCELLED,
      actor.employeeId,
    )
    revalidateTimeOff()
    return ok(request)
  } catch (error) {
    return toActionResult(error, "cancelRequest")
  }
}
