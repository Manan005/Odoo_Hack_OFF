import { ApprovalMode, RequestStatus, TimeOffUnit } from "@prisma/client"
import { z } from "zod"

const requiredDate = z
  .string()
  .trim()
  .min(1, "Date is required")
  .transform((v) => new Date(v))
  .refine((d) => !Number.isNaN(d.getTime()), { message: "Enter a valid date" })

const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()

// ───────────────────────────── Time Off Type ─────────────────────────────

export const timeOffTypeSchema = z.object({
  id: z.string().optional(),
  name: z.string().trim().min(1, "Type name is required").max(60),
  unit: z.nativeEnum(TimeOffUnit),
  requiresAllocation: z.boolean(),
  approvalMode: z.nativeEnum(ApprovalMode),
  workEntryLabel: optionalText,
  isPaid: z.boolean(),
  displayColor: z.string().min(1),
  active: z.boolean(),
  description: optionalText,
})

export type TimeOffTypeInput = z.infer<typeof timeOffTypeSchema>

// ───────────────────────────── Allocation ─────────────────────────────

export const allocationSchema = z.object({
  id: z.string().optional(),
  employeeId: z.string().min(1, "Select an employee"),
  typeId: z.string().min(1, "Select a time off type"),
  allocated: z
    .string()
    .trim()
    .min(1, "Allocated amount is required")
    .refine((v) => /^\d+(\.\d{1,2})?$/.test(v), "Enter a number like 20 or 7.5")
    .refine((v) => Number(v) > 0, "Allocation must be greater than zero"),
  // `taken` is deliberately absent — it is maintained by approve/release only.
  validityLabel: optionalText,
  description: optionalText,
})

export type AllocationInput = z.infer<typeof allocationSchema>

// ───────────────────────────── Request ─────────────────────────────

export const requestSchema = z
  .object({
    id: z.string().optional(),
    employeeId: z.string().min(1, "Select an employee"),
    typeId: z.string().min(1, "Select a time off type"),
    startDate: requiredDate,
    endDate: requiredDate,
    // `duration` is deliberately absent — derived from the working schedule.
    reason: optionalText,
  })
  .refine((r) => r.endDate >= r.startDate, {
    message: "End date must be on or after the start date",
    path: ["endDate"],
  })

export type RequestInput = z.infer<typeof requestSchema>

// ───────────────────────────── Labels ─────────────────────────────

export const UNIT_LABEL: Record<TimeOffUnit, string> = {
  DAYS: "Days",
  HOURS: "Hours",
}

export const APPROVAL_LABEL: Record<ApprovalMode, string> = {
  NO_VALIDATION: "No validation",
  MANAGER: "Manager",
  HR_OFFICER: "HR Officer",
  BOTH: "Manager and HR",
}

export const REQUEST_STATUS_LABEL: Record<RequestStatus, string> = {
  TO_APPROVE: "To Approve",
  APPROVED: "Approved",
  REFUSED: "Refused",
  CANCELLED: "Cancelled",
}

export const DISPLAY_COLORS = ["blue", "green", "amber", "red", "violet", "teal"] as const
