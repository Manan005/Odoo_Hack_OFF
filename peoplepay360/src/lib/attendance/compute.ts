import { AttendanceStatus, Prisma, Weekday } from "@prisma/client"
import { parseClock, weekdayOf } from "@/lib/dates"

/** Minutes after the scheduled start before an arrival counts as late. */
export const LATE_GRACE_MINUTES = 15

/**
 * The calendar day containing `now`, in the server's local time zone (the
 * office zone for this single-office app): [local midnight, next midnight).
 * Every "today" query — the check-in widget, the self-service actions, the
 * Today filter — must use both bounds. An open-ended `>= midnight` lets a
 * seeded or future-dated row stand in for today and lock the buttons.
 */
export function todayWindow(now: Date = new Date()): { start: Date; end: Date } {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 1)
  return { start, end }
}

/** Accepts a Prisma row directly — hours columns arrive as Decimal. */
export interface ScheduleLineLike {
  day: Weekday
  startTime: string
  endTime: string
  breakHours: Prisma.Decimal | number | string
  hours: Prisma.Decimal | number | string
}

/** The schedule line governing a given date, or null on a non-working day. */
export function lineForDate(
  date: Date,
  lines: ScheduleLineLike[],
): ScheduleLineLike | null {
  return lines.find((l) => l.day === weekdayOf(date)) ?? null
}

/**
 * BR-A1 — worked hours are the clock span, to 2dp.
 * A missing check-out yields 0.00 and is surfaced as an exception rather than
 * being guessed at.
 */
export function computeWorkedHours(checkIn: Date, checkOut: Date | null): number {
  if (!checkOut) return 0
  const ms = checkOut.getTime() - checkIn.getTime()
  if (ms <= 0) return 0
  return Number((ms / 3_600_000).toFixed(2))
}

/**
 * The scheduled clock span, break included — 09:00→18:00 is 9h even when the
 * line's net `hours` is 8h.
 *
 * `workedHours` is a raw clock span (BR-A1), so overtime and half-day must be
 * measured against the span too. Comparing a 9h span to the 8h net figure
 * would score an hour of overtime on every ordinary working day.
 */
export function scheduledSpan(line: ScheduleLineLike): number {
  return Number((parseClock(line.endTime) - parseClock(line.startTime)).toFixed(2))
}

/**
 * BR-A2 — overtime is whatever exceeds the scheduled span for that weekday.
 * With no schedule line (an unscheduled day) every worked hour is overtime.
 */
export function computeOvertime(workedHours: number, line: ScheduleLineLike | null): number {
  const expected = line ? scheduledSpan(line) : 0
  return Number(Math.max(0, workedHours - expected).toFixed(2))
}

/**
 * BR-A3 — LATE when arrival is past the scheduled start plus grace.
 * HALF_DAY when less than half the scheduled span was covered.
 */
export function computeStatus(
  checkIn: Date,
  workedHours: number,
  line: ScheduleLineLike | null,
): AttendanceStatus {
  if (!line) return AttendanceStatus.PRESENT

  const expected = scheduledSpan(line)
  const startHour = parseClock(line.startTime)
  const arrivalHour = checkIn.getHours() + checkIn.getMinutes() / 60
  const isLate = arrivalHour > startHour + LATE_GRACE_MINUTES / 60

  if (expected > 0 && workedHours > 0 && workedHours < expected / 2) {
    return AttendanceStatus.HALF_DAY
  }
  return isLate ? AttendanceStatus.LATE : AttendanceStatus.PRESENT
}

export interface DerivedAttendance {
  workedHours: number
  overtime: number
  status: AttendanceStatus
}

/**
 * One entry point so the form, the seed and any bulk import all derive the
 * same way. Callers never pass these values in (rules.md §6).
 */
export function deriveAttendance(
  checkIn: Date,
  checkOut: Date | null,
  lines: ScheduleLineLike[],
  explicitStatus?: AttendanceStatus,
): DerivedAttendance {
  const line = lineForDate(checkIn, lines)
  const workedHours = computeWorkedHours(checkIn, checkOut)
  const overtime = computeOvertime(workedHours, line)

  // ABSENT is a record of non-attendance, so its clock values stay zero.
  if (explicitStatus === AttendanceStatus.ABSENT) {
    return { workedHours: 0, overtime: 0, status: AttendanceStatus.ABSENT }
  }

  return {
    workedHours,
    overtime,
    status: explicitStatus ?? computeStatus(checkIn, workedHours, line),
  }
}

export const isMissingCheckOut = (a: { checkOut: Date | null; status: AttendanceStatus }) =>
  a.checkOut === null && a.status !== AttendanceStatus.ABSENT

export const ATTENDANCE_STATUS_LABEL: Record<AttendanceStatus, string> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  HALF_DAY: "Half Day",
}
