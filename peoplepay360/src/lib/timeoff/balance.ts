import { Prisma, RequestStatus, TimeOffUnit, Weekday } from "@prisma/client"
import { db } from "@/lib/db"
import { workingDaysBetween } from "@/lib/dates"
import { TimeOffError } from "@/lib/result"

export interface Balance {
  allocated: number
  taken: number
  remaining: number
}

export const ZERO_BALANCE: Balance = { allocated: 0, taken: 0, remaining: 0 }

/**
 * BR-T5 — the balance is derived. `taken` is maintained by approve/release
 * inside a transaction; `remaining` is never stored.
 */
export const balanceOf = (a: { allocated: unknown; taken: unknown }): Balance => {
  const allocated = Number(a.allocated)
  const taken = Number(a.taken)
  return { allocated, taken, remaining: Number((allocated - taken).toFixed(2)) }
}

/** Summed across every APPROVED allocation of this type for this employee. */
export async function getBalance(employeeId: string, typeId: string): Promise<Balance> {
  const allocations = await db.timeOffAllocation.findMany({
    where: { employeeId, typeId, status: RequestStatus.APPROVED },
    select: { allocated: true, taken: true },
  })
  return allocations.reduce<Balance>((acc, a) => {
    const b = balanceOf(a)
    return {
      allocated: acc.allocated + b.allocated,
      taken: acc.taken + b.taken,
      remaining: Number((acc.remaining + b.remaining).toFixed(2)),
    }
  }, ZERO_BALANCE)
}

/**
 * BR-T4 — duration counts only days that are working days on the employee's
 * schedule. Hour-unit types are expressed as hours-per-working-day.
 */
export async function computeDuration(
  employeeId: string,
  startDate: Date,
  endDate: Date,
  unit: TimeOffUnit,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<number> {
  const employee = await client.employee.findUnique({
    where: { id: employeeId },
    select: { workingSchedule: { select: { lines: true, hoursPerWeek: true } } },
  })

  const lines = employee?.workingSchedule?.lines ?? []
  const days = workingDaysBetween(
    startDate,
    endDate,
    lines.map((l) => l.day as Weekday),
  )

  if (unit === TimeOffUnit.DAYS) return days

  // Hours: use the average hours of a scheduled day rather than a flat 8.
  const perDay =
    lines.length > 0
      ? lines.reduce((sum, l) => sum + Number(l.hours), 0) / lines.length
      : 8
  return Number((days * perDay).toFixed(2))
}

/**
 * BR-T1 — the allocation gate.
 *
 * When the type requires an allocation, a request may only be submitted
 * against an APPROVED allocation with enough remaining. Returns the allocation
 * to link, or null for types that need none (BR-T3).
 *
 * The error names the actual remaining figure — "Insufficient balance" alone
 * is not actionable (rules.md §5).
 */
export async function assertCanRequest(
  employeeId: string,
  typeId: string,
  duration: number,
  excludeRequestId?: string,
  client: Prisma.TransactionClient | typeof db = db,
): Promise<{ allocationId: string | null }> {
  const type = await client.timeOffType.findUnique({
    where: { id: typeId },
    select: { name: true, unit: true, requiresAllocation: true, active: true },
  })
  if (!type) throw new TimeOffError("TYPE_NOT_FOUND", "That time off type no longer exists.")
  if (!type.active) {
    throw new TimeOffError("TYPE_INACTIVE", `${type.name} is no longer available.`, {
      typeId: "This leave type is inactive.",
    })
  }

  // BR-T3 — types that do not require an allocation never touch a balance.
  if (!type.requiresAllocation) return { allocationId: null }

  const allocations = await client.timeOffAllocation.findMany({
    where: { employeeId, typeId, status: RequestStatus.APPROVED },
    select: { id: true, allocated: true, taken: true, validityLabel: true },
    orderBy: { createdAt: "asc" },
  })

  if (allocations.length === 0) {
    throw new TimeOffError(
      "NO_ALLOCATION",
      `No approved ${type.name} allocation. An allocation must be approved before leave of this type can be requested.`,
      { typeId: `No approved ${type.name} allocation.` },
    )
  }

  // If this is an edit, the request's own consumption should not count against it.
  let alreadyTaken = 0
  if (excludeRequestId) {
    const existing = await client.timeOffRequest.findUnique({
      where: { id: excludeRequestId },
      select: { duration: true, status: true, allocationId: true },
    })
    if (existing?.status === RequestStatus.APPROVED && existing.allocationId) {
      alreadyTaken = Number(existing.duration)
    }
  }

  const unitLabel = type.unit === TimeOffUnit.DAYS ? "days" : "hours"

  // Prefer the oldest allocation that can absorb the whole request.
  const usable = allocations.find((a) => {
    const b = balanceOf(a)
    const effectiveRemaining = b.remaining + alreadyTaken
    return effectiveRemaining >= duration
  })

  if (!usable) {
    const totalRemaining = allocations.reduce((sum, a) => sum + balanceOf(a).remaining, 0)
    throw new TimeOffError(
      "INSUFFICIENT_BALANCE",
      `Only ${Number((totalRemaining + alreadyTaken).toFixed(2))} ${unitLabel} remaining on ${type.name}; requested ${duration}.`,
      {
        endDate: `Only ${Number((totalRemaining + alreadyTaken).toFixed(2))} ${unitLabel} remaining.`,
      },
    )
  }

  return { allocationId: usable.id }
}

/**
 * BR-T2 — approving consumes balance. Status and balance move together inside
 * one transaction so they can never diverge.
 */
export async function approveRequest(requestId: string, approverId: string | null) {
  return db.$transaction(async (tx) => {
    const request = await tx.timeOffRequest.findUnique({
      where: { id: requestId },
      select: {
        id: true,
        status: true,
        duration: true,
        allocationId: true,
        employeeId: true,
        typeId: true,
      },
    })
    if (!request) throw new TimeOffError("NOT_FOUND", "That request no longer exists.")
    if (request.status === RequestStatus.APPROVED) {
      throw new TimeOffError("ALREADY_APPROVED", "This request is already approved.")
    }

    // Re-check the gate at approval time — the balance may have moved since
    // the request was raised.
    const { allocationId } = await assertCanRequest(
      request.employeeId,
      request.typeId,
      Number(request.duration),
      request.id,
      tx,
    )

    if (allocationId) {
      await tx.timeOffAllocation.update({
        where: { id: allocationId },
        data: { taken: { increment: request.duration } },
      })
    }

    return tx.timeOffRequest.update({
      where: { id: requestId },
      data: { status: RequestStatus.APPROVED, approverId, allocationId },
      select: { id: true },
    })
  })
}

/**
 * BR-T2 — refusing or cancelling a previously approved request releases the
 * days back to its allocation.
 */
export async function releaseRequest(
  requestId: string,
  // Prisma enums are const objects, so a member is not usable in type
  // position — the literal union is the equivalent.
  nextStatus: "REFUSED" | "CANCELLED",
  approverId: string | null,
) {
  return db.$transaction(async (tx) => {
    const request = await tx.timeOffRequest.findUnique({
      where: { id: requestId },
      select: { id: true, status: true, duration: true, allocationId: true },
    })
    if (!request) throw new TimeOffError("NOT_FOUND", "That request no longer exists.")

    // Only an approved request has consumed anything to give back.
    if (request.status === RequestStatus.APPROVED && request.allocationId) {
      await tx.timeOffAllocation.update({
        where: { id: request.allocationId },
        data: { taken: { decrement: request.duration } },
      })
    }

    return tx.timeOffRequest.update({
      where: { id: requestId },
      data: { status: nextStatus, approverId },
      select: { id: true },
    })
  })
}
