import { CalendarType, Weekday } from "@prisma/client"
import { z } from "zod"

const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/

export const scheduleLineSchema = z
  .object({
    day: z.nativeEnum(Weekday),
    startTime: z.string().regex(CLOCK, "Use HH:mm"),
    endTime: z.string().regex(CLOCK, "Use HH:mm"),
    breakHours: z.coerce.number().min(0, "Break cannot be negative").max(12),
  })
  .refine((l) => l.endTime > l.startTime, {
    message: "End time must be after start time",
    path: ["endTime"],
  })

export const scheduleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1, "Schedule name is required").max(60),
  calendarType: z.nativeEnum(CalendarType),
  timezone: z.string().min(1).default("Asia/Kolkata"),
  active: z.boolean().default(true),
  lines: z
    .array(scheduleLineSchema)
    .min(1, "Add at least one working day")
    // BR-S2: one line per weekday.
    .refine((lines) => new Set(lines.map((l) => l.day)).size === lines.length, {
      message: "Each weekday can only appear once",
    }),
})

export type ScheduleInput = z.infer<typeof scheduleSchema>
export type ScheduleLineFormInput = z.infer<typeof scheduleLineSchema>
