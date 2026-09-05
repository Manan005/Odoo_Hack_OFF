"use server"

import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { ROLE_RANK, rankOf, requireAuth, requireRole } from "@/lib/auth-guard"
import { deriveAttendance } from "@/lib/attendance/compute"
import { db } from "@/lib/db"
import { DomainError, ok, toActionResult, type ActionResult } from "@/lib/result"
import { attendanceSchema } from "@/lib/validation/attendance"

/** Schedule lines for an employee, falling back to their contract's schedule. */
async function scheduleLinesFor(employeeId: string) {
  const employee = await db.employee.findUnique({
    where: { id: employeeId },
    select: { workingSchedule: { select: { lines: true } } },
  })
  return employee?.workingSchedule?.lines ?? []
}

export async function saveAttendance(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAuth()
    const input = attendanceSchema.parse(raw)

    const isHr = rankOf(actor.roles) >= ROLE_RANK.HR_MANAGER
    // BR-A4: an employee may only log their own time; edits are HR-only.
    if (!isHr) {
      if (input.employeeId !== actor.employeeId) {
        throw new DomainError("FORBIDDEN", "You can only record your own attendance.")
      }
      if (input.id) {
        throw new DomainError(
          "FORBIDDEN",
          "Attendance corrections are restricted to HR. Ask your manager to amend this record.",
        )
      }
    }

    const lines = await scheduleLinesFor(input.employeeId)
    const derived = deriveAttendance(input.checkIn, input.checkOut, lines, input.status)

    const data = {
      employeeId: input.employeeId,
      checkIn: input.checkIn,
      checkOut: input.checkOut,
      workedHours: derived.workedHours,
      overtime: derived.overtime,
      status: derived.status,
      notes: input.notes,
    }

    let record: { id: string }
    if (input.id) {
      const existing = await db.attendance.findUnique({
        where: { id: input.id },
        select: { id: true },
      })
      if (!existing) throw new DomainError("NOT_FOUND", "That attendance record no longer exists.")

      // BR-A4: every HR correction is flagged and attributed.
      record = await db.attendance.update({
        where: { id: input.id },
        data: { ...data, manuallyEdited: true, editedById: actor.id, editedAt: new Date() },
        select: { id: true },
      })
    } else {
      record = await db.attendance.create({ data, select: { id: true } })
    }

    revalidatePath("/attendance")
    revalidatePath(`/attendance/${record.id}`)
    revalidatePath(`/employees/${input.employeeId}`)
    return ok(record)
  } catch (error) {
    return toActionResult(error, "saveAttendance")
  }
}

/** Employee self-service: stamp a check-in for right now. */
export async function checkIn(): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAuth()
    if (!actor.employeeId) {
      throw new DomainError("NO_EMPLOYEE", "Your account is not linked to an employee record.")
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const open = await db.attendance.findFirst({
      where: { employeeId: actor.employeeId, checkIn: { gte: startOfToday } },
      select: { id: true, checkOut: true },
    })
    if (open) {
      throw new DomainError(
        "ALREADY_CHECKED_IN",
        open.checkOut
          ? "You have already recorded attendance today."
          : "You are already checked in.",
      )
    }

    const lines = await scheduleLinesFor(actor.employeeId)
    const now = new Date()
    const derived = deriveAttendance(now, null, lines)

    const record = await db.attendance.create({
      data: {
        employeeId: actor.employeeId,
        checkIn: now,
        checkOut: null,
        workedHours: 0,
        overtime: 0,
        status: derived.status,
      },
      select: { id: true },
    })

    revalidatePath("/attendance")
    return ok(record)
  } catch (error) {
    return toActionResult(error, "checkIn")
  }
}

/** Employee self-service: close today's open entry. */
export async function checkOut(): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireAuth()
    if (!actor.employeeId) {
      throw new DomainError("NO_EMPLOYEE", "Your account is not linked to an employee record.")
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const open = await db.attendance.findFirst({
      where: {
        employeeId: actor.employeeId,
        checkIn: { gte: startOfToday },
        checkOut: null,
      },
      orderBy: { checkIn: "desc" },
      select: { id: true, checkIn: true, status: true },
    })
    if (!open) throw new DomainError("NOT_CHECKED_IN", "You have no open check-in today.")

    const lines = await scheduleLinesFor(actor.employeeId)
    const now = new Date()
    const derived = deriveAttendance(open.checkIn, now, lines, open.status)

    const record = await db.attendance.update({
      where: { id: open.id },
      data: {
        checkOut: now,
        workedHours: derived.workedHours,
        overtime: derived.overtime,
        status: derived.status,
      },
      select: { id: true },
    })

    revalidatePath("/attendance")
    return ok(record)
  } catch (error) {
    return toActionResult(error, "checkOut")
  }
}

export async function deleteAttendance(id: string): Promise<ActionResult<void>> {
  try {
    await requireRole(Role.HR_MANAGER)
    await db.attendance.delete({ where: { id } })
    revalidatePath("/attendance")
    return ok(undefined)
  } catch (error) {
    return toActionResult(error, "deleteAttendance")
  }
}
