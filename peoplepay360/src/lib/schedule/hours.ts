import { Weekday } from "@prisma/client"
import { parseClock } from "@/lib/dates"

export interface ScheduleLineInput {
  day: Weekday
  startTime: string
  endTime: string
  breakHours: number
}

export const WEEKDAY_ORDER: Weekday[] = [
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
  Weekday.SUNDAY,
]

export const WEEKDAY_LABEL: Record<Weekday, string> = {
  MONDAY: "Monday",
  TUESDAY: "Tuesday",
  WEDNESDAY: "Wednesday",
  THURSDAY: "Thursday",
  FRIDAY: "Friday",
  SATURDAY: "Saturday",
  SUNDAY: "Sunday",
}

/**
 * BR-S1: a line's hours are always derived from its own pattern.
 * `(end − start) − break`, never a number the user typed.
 */
export function deriveLineHours(line: ScheduleLineInput): number {
  const span = parseClock(line.endTime) - parseClock(line.startTime)
  const hours = span - line.breakHours
  return Number(Math.max(0, hours).toFixed(2))
}

/**
 * BR-S1: weekly totals are derived from the lines, so the list view and the
 * form can never disagree.
 */
export function deriveWeeklyTotals(lines: ScheduleLineInput[]): {
  daysPerWeek: number
  hoursPerWeek: number
} {
  const hoursPerWeek = lines.reduce((sum, l) => sum + deriveLineHours(l), 0)
  return {
    daysPerWeek: lines.length,
    hoursPerWeek: Number(hoursPerWeek.toFixed(2)),
  }
}

/** Sort lines into calendar order regardless of entry order. */
export const sortLines = <T extends { day: Weekday }>(lines: T[]): T[] =>
  [...lines].sort((a, b) => WEEKDAY_ORDER.indexOf(a.day) - WEEKDAY_ORDER.indexOf(b.day))

/** `40h`, `37.5h` — trailing `.0` is noise in a table. */
export const formatWeeklyHours = (hours: number): string =>
  `${Number.isInteger(hours) ? hours : hours.toFixed(1)}h`
