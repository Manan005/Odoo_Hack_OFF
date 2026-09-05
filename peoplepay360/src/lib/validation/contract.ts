import { ContractStatus } from "@prisma/client"
import { z } from "zod"

const requiredDate = z
  .string()
  .trim()
  .min(1, "Start date is required")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Enter a valid date" })

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(v)))
  .nullable()
  .refine((d) => d === null || !Number.isNaN(d.getTime()), { message: "Enter a valid date" })

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()

export const contractSchema = z
  .object({
    id: z.string().optional(),
    employeeId: z.string().min(1, "Select an employee"),
    startDate: requiredDate,
    endDate: optionalDate,
    // Money arrives as a string from the form and stays a string until Prisma
    // turns it into a Decimal — never parseFloat (rules.md §3).
    wage: z
      .string()
      .trim()
      .min(1, "Monthly wage is required")
      .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter an amount like 85000 or 85000.50")
      .refine((v) => Number(v) > 0, "Wage must be greater than zero"),
    status: z.nativeEnum(ContractStatus),
    departmentId: optionalId,
    jobPositionId: optionalId,
    workingScheduleId: optionalId,
    salaryStructureId: optionalId,
    notes: z
      .string()
      .trim()
      .transform((v) => (v === "" ? null : v))
      .nullable(),
  })
  .refine((c) => c.endDate === null || c.endDate >= c.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })

export type ContractInput = z.infer<typeof contractSchema>

export const CONTRACT_STATUS_LABEL: Record<ContractStatus, string> = {
  DRAFT: "Draft",
  RUNNING: "Running",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
}
