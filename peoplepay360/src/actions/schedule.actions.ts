"use server"

import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { DomainError, ok, toActionResult, type ActionResult } from "@/lib/result"
import { deriveLineHours, deriveWeeklyTotals } from "@/lib/schedule/hours"
import { scheduleSchema } from "@/lib/validation/schedule"

export async function saveSchedule(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_MANAGER)
    const input = scheduleSchema.parse(raw)

    // BR-S1: totals are computed here, never taken from the client payload.
    const { daysPerWeek, hoursPerWeek } = deriveWeeklyTotals(input.lines)

    const lineData = input.lines.map((l) => ({
      day: l.day,
      startTime: l.startTime,
      endTime: l.endTime,
      breakHours: l.breakHours,
      hours: deriveLineHours(l),
    }))

    const scheduleId = await db.$transaction(async (tx) => {
      if (input.id) {
        const existing = await tx.workingSchedule.findUnique({
          where: { id: input.id },
          select: { id: true },
        })
        if (!existing) throw new DomainError("NOT_FOUND", "That schedule no longer exists.")

        await tx.workingSchedule.update({
          where: { id: input.id },
          data: {
            name: input.name,
            calendarType: input.calendarType,
            timezone: input.timezone,
            active: input.active,
            daysPerWeek,
            hoursPerWeek,
          },
        })
        // Replace the pattern wholesale so removed days actually disappear.
        await tx.scheduleLine.deleteMany({ where: { scheduleId: input.id } })
        await tx.scheduleLine.createMany({
          data: lineData.map((l) => ({ ...l, scheduleId: input.id! })),
        })
        return input.id
      }

      const created = await tx.workingSchedule.create({
        data: {
          name: input.name,
          calendarType: input.calendarType,
          timezone: input.timezone,
          active: input.active,
          daysPerWeek,
          hoursPerWeek,
          companyId: actor.companyId,
          lines: { createMany: { data: lineData } },
        },
        select: { id: true },
      })
      return created.id
    })

    revalidatePath("/working-schedules")
    revalidatePath(`/working-schedules/${scheduleId}`)
    return ok({ id: scheduleId })
  } catch (error) {
    // Unique constraint on (companyId, name) surfaces as a Prisma P2002.
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code: string }).code === "P2002"
    ) {
      return toActionResult(
        new DomainError("NAME_TAKEN", "A schedule with that name already exists.", {
          name: "Name already in use.",
        }),
        "saveSchedule",
      )
    }
    return toActionResult(error, "saveSchedule")
  }
}
