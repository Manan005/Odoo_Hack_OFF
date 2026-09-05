import { EmployeeType, Gender } from "@prisma/client"
import { z } from "zod"

/** Empty strings from HTML inputs become null, not "". */
const optionalText = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()

const optionalEmail = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .refine((v) => v === null || z.string().email().safeParse(v).success, {
    message: "Enter a valid email address",
  })

const optionalDate = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : new Date(v)))
  .nullable()
  .refine((v) => v === null || !Number.isNaN(v.getTime()), { message: "Enter a valid date" })

const optionalId = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v))
  .nullable()

export const employeeSchema = z.object({
  id: z.string().optional(),

  // Work information
  firstName: z.string().trim().min(1, "First name is required").max(50),
  lastName: z.string().trim().min(1, "Last name is required").max(50),
  workEmail: optionalEmail,
  workPhone: optionalText,
  employeeType: z.nativeEnum(EmployeeType),
  workLocation: optionalText,
  departmentId: optionalId,
  jobPositionId: optionalId,
  managerId: optionalId,
  workingScheduleId: optionalId,
  active: z.boolean().default(true),

  // Private information
  personalEmail: optionalEmail,
  personalPhone: optionalText,
  dateOfBirth: optionalDate,
  gender: z.nativeEnum(Gender).nullable(),
  address: optionalText,
  emergencyContactName: optionalText,
  emergencyContactPhone: optionalText,
  bankAccountNumber: optionalText,
  bankName: optionalText,
  bankIfsc: optionalText,

  // HR settings
  joiningDate: optionalDate,
})

export type EmployeeInput = z.infer<typeof employeeSchema>

export const EMPLOYEE_TYPE_LABEL: Record<EmployeeType, string> = {
  FULL_TIME: "Full-time",
  PART_TIME: "Part-time",
  CONTRACT: "Contract",
  INTERN: "Intern",
  FREELANCE: "Freelance",
}

export const GENDER_LABEL: Record<Gender, string> = {
  MALE: "Male",
  FEMALE: "Female",
  OTHER: "Other",
  UNDISCLOSED: "Prefer not to say",
}
