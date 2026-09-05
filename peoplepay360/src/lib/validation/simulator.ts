import { z } from "zod"

/**
 * Every override is optional. Blank means "use the real fact", which is what
 * makes the zero-override run reproduce the stored payslip exactly.
 */
const optionalNumber = (label: string, max: number) =>
  z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || !Number.isNaN(Number(v)), `${label} must be a number`)
    .refine((v) => v === null || Number(v) >= 0, `${label} cannot be negative`)
    .refine((v) => v === null || Number(v) <= max, `${label} is unrealistically large`)
    .nullable()

const requiredDate = z
  .string()
  .trim()
  .min(1, "Period is required")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Enter a valid date" })

export const simulationSchema = z
  .object({
    employeeId: z.string().min(1, "Select an employee"),
    structureId: z.string().min(1, "Select a salary structure"),
    periodStart: requiredDate,
    periodEnd: requiredDate,
    wage: optionalNumber("Wage", 100_000_000),
    workedDays: optionalNumber("Worked days", 366),
    overtimeHours: optionalNumber("Overtime hours", 1_000),
    unpaidLeaveDays: optionalNumber("Unpaid leave days", 366),
  })
  .refine((v) => v.periodEnd >= v.periodStart, {
    message: "Period end must be on or after period start",
    path: ["periodEnd"],
  })

export type SimulationInput = z.infer<typeof simulationSchema>
