"use server"

import { AttendanceStatus, Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { ROLE_RANK, rankOf, requireAuth, requireRole } from "@/lib/auth-guard"
import { deriveAttendance, todayWindow } from "@/lib/attendance/compute"
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

/** Both self-service stamps move the attendance panel on the dashboard too. */
function revalidateAttendance() {
  revalidatePath("/attendance")
  revalidatePath("/payroll/dashboard")
}

/**
 * Employee self-service: start — or resume — today's record.
 *
 * One record per day. A day that is already checked out is reopened and its
 * hours recount from the first check-in at the next check-out (BR-A1 is the
 * clock span, so the break is included). A day marked ABSENT becomes a
 * presence from now. Neither is a manual correction, so `manuallyEdited`
 * stays false (BR-A4 is about HR edits).
 */
export async function checkIn(): Promise<ActionResult<{ id: string; resumed: boolean }>> {
  try {
    const actor = await requireAuth()
    if (!actor.employeeId) {
      throw new DomainError("NO_EMPLOYEE", "Your account is not linked to an employee record.")
    }

    const { start, end } = todayWindow()
    const existing = await db.attendance.findFirst({
      where: { employeeId: actor.employeeId, checkIn: { gte: start, lt: end } },
      orderBy: { checkIn: "asc" },
      select: { id: true, checkIn: true, checkOut: true, status: true },
    })

    const lines = await scheduleLinesFor(actor.employeeId)
    const now = new Date()

    if (!existing) {
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
      revalidateAttendance()
      return ok({ id: record.id, resumed: false })
    }

    const absent = existing.status === AttendanceStatus.ABSENT
    if (!absent && existing.checkOut === null) {
      throw new DomainError("ALREADY_CHECKED_IN", "You are already checked in.")
    }

    // An absence has no real arrival time; a checked-out day keeps its first.
    const checkInAt = absent ? now : existing.checkIn
    const derived = deriveAttendance(checkInAt, null, lines)
    const record = await db.attendance.update({
      where: { id: existing.id },
      data: {
        checkIn: checkInAt,
        checkOut: null,
        workedHours: 0,
        overtime: 0,
        status: derived.status,
      },
      select: { id: true },
    })

    revalidateAttendance()
    return ok({ id: record.id, resumed: true })
  } catch (error) {
    return toActionResult(error, "checkIn")
  }
}

/** Employee self-service: close today's open entry and recount its hours. */
export async function checkOut(): Promise<ActionResult<{ id: string; workedHours: string }>> {
  try {
    const actor = await requireAuth()
    if (!actor.employeeId) {
      throw new DomainError("NO_EMPLOYEE", "Your account is not linked to an employee record.")
    }

    const { start, end } = todayWindow()
    const open = await db.attendance.findFirst({
      where: {
        employeeId: actor.employeeId,
        checkIn: { gte: start, lt: end },
        checkOut: null,
        status: { not: AttendanceStatus.ABSENT },
      },
      orderBy: { checkIn: "asc" },
      select: { id: true, checkIn: true },
    })
    if (!open) throw new DomainError("NOT_CHECKED_IN", "You are not checked in today.")

    const lines = await scheduleLinesFor(actor.employeeId)
    const now = new Date()
    // Re-derived from the clock span, so a short day can become HALF_DAY and
    // a late arrival stays LATE (BR-A1..A3).
    const derived = deriveAttendance(open.checkIn, now, lines)

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

    revalidateAttendance()
    return ok({ id: record.id, workedHours: derived.workedHours.toFixed(2) })
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
