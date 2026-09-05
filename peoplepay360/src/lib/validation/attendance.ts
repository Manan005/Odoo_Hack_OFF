import { AttendanceStatus } from "@prisma/client"
import { z } from "zod"

const requiredDateTime = z
  .string()
  .trim()
  .min(1, "Check in is required")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Enter a valid date and time" })

const optionalDateTime = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(v)))
  .nullable()
  .refine((d) => d === null || !Number.isNaN(d.getTime()), {
    message: "Enter a valid date and time",
  })

export const attendanceSchema = z
  .object({
    id: z.string().optional(),
    employeeId: z.string().min(1, "Select an employee"),
    checkIn: requiredDateTime,
    checkOut: optionalDateTime,
    // Workedhours and overtime are deliberately absent — they are derived
    // server-side and a client-supplied value must never be trusted.
    status: z.nativeEnum(AttendanceStatus),
    notes: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable(),
  })
  .refine((a) => a.checkOut === null || a.checkOut > a.checkIn, {
    message: "Check out must be after check in",
    path: ["checkOut"],
  })

export type AttendanceInput = z.infer<typeof attendanceSchema>
