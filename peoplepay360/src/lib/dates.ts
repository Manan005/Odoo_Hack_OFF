import { Weekday } from "@prisma/client"
import {
  eachDayOfInterval,
  endOfMonth,
  format,
  isWithinInterval,
  max as maxDate,
  min as minDate,
  startOfDay,
  startOfMonth,
} from "date-fns"

// ───────────────────────────── Formatting ─────────────────────────────
// Formats are fixed by design.md §9 — do not improvise per screen.

export const fmtDate = (d: Date | null | undefined): string =>
  d ? format(d, "dd-MMM-yyyy") : "—"

export const fmtDateCompact = (d: Date | null | undefined): string =>
  d ? format(d, "dd-MMM-yy") : "—"

export const fmtDateTime = (d: Date | null | undefined): string =>
  d ? format(d, "dd-MMM-yyyy HH:mm") : "—"

export const fmtTime = (d: Date | null | undefined): string => (d ? format(d, "HH:mm") : "—")

/** `01-Feb — 28-Feb` */
export const fmtRange = (start: Date, end: Date): string =>
  `${format(start, "dd-MMM")} — ${format(end, "dd-MMM")}`

/** `February 2026` */
export const fmtPeriod = (d: Date): string => format(d, "MMMM yyyy")

// ─────────────────────────── Period helpers ───────────────────────────

export const monthPeriod = (d: Date): { periodStart: Date; periodEnd: Date } => ({
  periodStart: startOfMonth(d),
  periodEnd: endOfMonth(d),
})

/** True when [aStart, aEnd] and [bStart, bEnd] share any day. Null end = open-ended. */
export function rangesOverlap(
  aStart: Date,
  aEnd: Date | null,
  bStart: Date,
  bEnd: Date | null,
): boolean {
  const aEndsBeforeB = aEnd !== null && aEnd < bStart
  const bEndsBeforeA = bEnd !== null && bEnd < aStart
  return !aEndsBeforeB && !bEndsBeforeA
}

/** Clip [start, end] to [periodStart, periodEnd]; null when they do not intersect. */
export function clipToPeriod(
  start: Date,
  end: Date,
  periodStart: Date,
  periodEnd: Date,
): { start: Date; end: Date } | null {
  if (!rangesOverlap(start, end, periodStart, periodEnd)) return null
  return { start: maxDate([start, periodStart]), end: minDate([end, periodEnd]) }
}

// ───────────────────────── Working-day counting ─────────────────────────

const WEEKDAY_BY_INDEX: Weekday[] = [
  Weekday.SUNDAY,
  Weekday.MONDAY,
  Weekday.TUESDAY,
  Weekday.WEDNESDAY,
  Weekday.THURSDAY,
  Weekday.FRIDAY,
  Weekday.SATURDAY,
]

export const weekdayOf = (d: Date): Weekday => WEEKDAY_BY_INDEX[d.getDay()]

/**
 * BR-T4 / worked-days: only days whose weekday has a ScheduleLine count.
 * Pass the schedule's line days; an empty set falls back to Mon–Fri so an
 * employee without a schedule still produces a sane duration rather than 0.
 */
export function workingDaysBetween(
  start: Date,
  end: Date,
  scheduleDays: Weekday[] | Set<Weekday>,
): number {
  const days = scheduleDays instanceof Set ? scheduleDays : new Set(scheduleDays)
  const effective: Set<Weekday> =
    days.size > 0
      ? days
      : new Set([
          Weekday.MONDAY,
          Weekday.TUESDAY,
          Weekday.WEDNESDAY,
          Weekday.THURSDAY,
          Weekday.FRIDAY,
        ])

  if (startOfDay(end) < startOfDay(start)) return 0

  return eachDayOfInterval({ start: startOfDay(start), end: startOfDay(end) }).filter((d) =>
    effective.has(weekdayOf(d)),
  ).length
}

export const isInPeriod = (d: Date, periodStart: Date, periodEnd: Date): boolean =>
  isWithinInterval(d, { start: startOfDay(periodStart), end: endOfMonth(periodEnd) })

/** "09:00" → decimal hours since midnight. */
export function parseClock(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) {
    throw new Error(`Invalid time "${hhmm}" — expected HH:mm`)
  }
  return h + m / 60
}
