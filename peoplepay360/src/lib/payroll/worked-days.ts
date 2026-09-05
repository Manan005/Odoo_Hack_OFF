import { AttendanceStatus, Prisma, RequestStatus, Weekday } from "@prisma/client"
import { clipToPeriod, weekdayOf } from "@/lib/dates"

export interface PeriodFacts {
  scheduledDays: number
  workedDays: number
  absentDays: number
  paidLeaveDays: number
  unpaidLeaveDays: number
  workedHours: number
  overtimeHours: number
  hoursPerWeek: number
}

export interface AttendanceLike {
  checkIn: Date
  workedHours: Prisma.Decimal | number
  overtime: Prisma.Decimal | number
  status: AttendanceStatus
}

export interface LeaveLike {
  startDate: Date
  endDate: Date
  duration: Prisma.Decimal | number
  status: RequestStatus
  type: { isPaid: boolean }
}

/** Days in the period whose weekday appears on the working schedule. */
export function countScheduledDays(
  periodStart: Date,
  periodEnd: Date,
  scheduleDays: Weekday[],
): number {
  if (scheduleDays.length === 0) return 0
  const days = new Set(scheduleDays)
  let count = 0
  const cursor = new Date(periodStart)
  while (cursor <= periodEnd) {
    if (days.has(weekdayOf(cursor))) count++
    cursor.setDate(cursor.getDate() + 1)
  }
  return count
}

/**
 * The facts a payslip computes against.
 *
 *   scheduledDays  = working days in the period per the schedule
 *   unpaidLeaveDays = approved leave on unpaid types, clipped to the period
 *   absentDays     = attendance rows marked ABSENT
 *   workedDays     = scheduledDays − unpaidLeaveDays − absentDays
 *
 * With no attendance at all, workedDays falls back to scheduledDays less any
 * unpaid leave, so an employee still gets a sensible payslip rather than zero.
 */
export function buildPeriodFacts({
  periodStart,
  periodEnd,
  scheduleDays,
  hoursPerWeek,
  attendance,
  leave,
}: {
  periodStart: Date
  periodEnd: Date
  scheduleDays: Weekday[]
  hoursPerWeek: number
  attendance: AttendanceLike[]
  leave: LeaveLike[]
}): PeriodFacts {
  const scheduledDays = countScheduledDays(periodStart, periodEnd, scheduleDays)

  const absentDays = attendance.filter((a) => a.status === AttendanceStatus.ABSENT).length

  const workedHours = attendance.reduce((sum, a) => sum + Number(a.workedHours), 0)
  const overtimeHours = attendance.reduce((sum, a) => sum + Number(a.overtime), 0)

  let paidLeaveDays = 0
  let unpaidLeaveDays = 0
  for (const l of leave) {
    if (l.status !== RequestStatus.APPROVED) continue
    const clipped = clipToPeriod(l.startDate, l.endDate, periodStart, periodEnd)
    if (!clipped) continue

    // Pro-rate when a request straddles the period boundary.
    const totalSpan = countDaysInclusive(l.startDate, l.endDate)
    const inPeriodSpan = countDaysInclusive(clipped.start, clipped.end)
    const share = totalSpan > 0 ? inPeriodSpan / totalSpan : 0
    const days = Number(l.duration) * share

    if (l.type.isPaid) paidLeaveDays += days
    else unpaidLeaveDays += days
  }

  const workedDays = Math.max(
    0,
    scheduledDays - round2(unpaidLeaveDays) - absentDays,
  )

  return {
    scheduledDays,
    workedDays: round2(workedDays),
    absentDays,
    paidLeaveDays: round2(paidLeaveDays),
    unpaidLeaveDays: round2(unpaidLeaveDays),
    workedHours: round2(workedHours),
    overtimeHours: round2(overtimeHours),
    hoursPerWeek,
  }
}

const countDaysInclusive = (start: Date, end: Date): number =>
  Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1

const round2 = (n: number): number => Number(n.toFixed(2))
