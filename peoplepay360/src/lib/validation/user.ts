import { Role } from "@prisma/client"
import { z } from "zod"

export const createUserSchema = z.object({
  employeeId: z.string().min(1, "Select an employee"),
  email: z.string().min(1, "Work email is required").email("Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  roles: z.array(z.nativeEnum(Role)).min(1, "Assign at least one role"),
  active: z.boolean().default(true),
})

export const updateUserSchema = z.object({
  userId: z.string().min(1),
  email: z.string().min(1, "Work email is required").email("Enter a valid email address"),
  // Blank means "leave the existing password alone".
  password: z
    .string()
    .refine((v) => v === "" || v.length >= 8, "Password must be at least 8 characters")
    .optional(),
  roles: z.array(z.nativeEnum(Role)).min(1, "Assign at least one role"),
  active: z.boolean(),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
export type UpdateUserInput = z.infer<typeof updateUserSchema>
