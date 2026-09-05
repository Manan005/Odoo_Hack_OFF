"use server"

import { Role } from "@prisma/client"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { DomainError, ok, toActionResult, type ActionResult } from "@/lib/result"
import { employeeSchema } from "@/lib/validation/employee"

/** EMP/0001, EMP/0002, … — sequential on the highest existing code. */
async function nextEmployeeCode(): Promise<string> {
  const last = await db.employee.findFirst({
    where: { employeeCode: { startsWith: "EMP/" } },
    orderBy: { employeeCode: "desc" },
    select: { employeeCode: true },
  })
  const n = last ? Number(last.employeeCode.split("/")[1]) + 1 : 1
  return `EMP/${String(n).padStart(4, "0")}`
}

const AVATAR_COLORS = ["indigo", "teal", "amber", "magenta", "green"]

export async function createEmployee(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_MANAGER)
    const input = employeeSchema.parse(raw)

    if (input.workEmail) {
      const clash = await db.employee.findUnique({ where: { workEmail: input.workEmail } })
      if (clash) {
        throw new DomainError("EMAIL_TAKEN", "That work email is already in use.", {
          workEmail: "Work email already in use.",
        })
      }
    }

    const count = await db.employee.count()
    const employee = await db.employee.create({
      data: {
        employeeCode: await nextEmployeeCode(),
        firstName: input.firstName,
        lastName: input.lastName,
        workEmail: input.workEmail,
        workPhone: input.workPhone,
        employeeType: input.employeeType,
        workLocation: input.workLocation,
        active: input.active,
        avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
        personalEmail: input.personalEmail,
        personalPhone: input.personalPhone,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        address: input.address,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        bankAccountNumber: input.bankAccountNumber,
        bankName: input.bankName,
        bankIfsc: input.bankIfsc,
        joiningDate: input.joiningDate,
        companyId: actor.companyId,
        departmentId: input.departmentId,
        jobPositionId: input.jobPositionId,
        managerId: input.managerId,
        workingScheduleId: input.workingScheduleId,
      },
      select: { id: true },
    })

    revalidatePath("/employees")
    return ok(employee)
  } catch (error) {
    return toActionResult(error, "createEmployee")
  }
}

export async function updateEmployee(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole(Role.HR_MANAGER)
    const input = employeeSchema.parse(raw)
    if (!input.id) throw new DomainError("MISSING_ID", "Employee id is required.")

    const existing = await db.employee.findUnique({
      where: { id: input.id },
      select: { id: true, workEmail: true },
    })
    if (!existing) throw new DomainError("NOT_FOUND", "That employee no longer exists.")

    if (input.workEmail && input.workEmail !== existing.workEmail) {
      const clash = await db.employee.findUnique({ where: { workEmail: input.workEmail } })
      if (clash) {
        throw new DomainError("EMAIL_TAKEN", "That work email is already in use.", {
          workEmail: "Work email already in use.",
        })
      }
    }

    // An employee cannot be their own manager, nor manage their own manager.
    if (input.managerId === input.id) {
      throw new DomainError("SELF_MANAGER", "An employee cannot be their own manager.", {
        managerId: "Pick a different manager.",
      })
    }

    const employee = await db.employee.update({
      where: { id: input.id },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        workEmail: input.workEmail,
        workPhone: input.workPhone,
        employeeType: input.employeeType,
        workLocation: input.workLocation,
        active: input.active,
        personalEmail: input.personalEmail,
        personalPhone: input.personalPhone,
        dateOfBirth: input.dateOfBirth,
        gender: input.gender,
        address: input.address,
        emergencyContactName: input.emergencyContactName,
        emergencyContactPhone: input.emergencyContactPhone,
        bankAccountNumber: input.bankAccountNumber,
        bankName: input.bankName,
        bankIfsc: input.bankIfsc,
        joiningDate: input.joiningDate,
        departmentId: input.departmentId,
        jobPositionId: input.jobPositionId,
        managerId: input.managerId,
        workingScheduleId: input.workingScheduleId,
      },
      select: { id: true },
    })

    revalidatePath("/employees")
    revalidatePath(`/employees/${employee.id}`)
    return ok(employee)
  } catch (error) {
    return toActionResult(error, "updateEmployee")
  }
}

// ───────────────────── Departments & job positions ─────────────────────

export async function upsertDepartment(raw: {
  id?: string
  name: string
  managerId?: string | null
}): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.HR_MANAGER)
    const name = raw.name?.trim()
    if (!name) {
      throw new DomainError("VALIDATION", "Department name is required.", {
        name: "Name is required.",
      })
    }

    const managerId = raw.managerId || null
    const dept = raw.id
      ? await db.department.update({
          where: { id: raw.id },
          data: { name, managerId },
          select: { id: true },
        })
      : await db.department.create({
          data: { name, managerId, companyId: actor.companyId },
          select: { id: true },
        })

    revalidatePath("/departments")
    return ok(dept)
  } catch (error) {
    return toActionResult(error, "upsertDepartment")
  }
}

export async function upsertJobPosition(raw: {
  id?: string
  name: string
}): Promise<ActionResult<{ id: string }>> {
  try {
    await requireRole(Role.HR_MANAGER)
    const name = raw.name?.trim()
    if (!name) {
      throw new DomainError("VALIDATION", "Position name is required.", {
        name: "Name is required.",
      })
    }

    const position = raw.id
      ? await db.jobPosition.update({
          where: { id: raw.id },
          data: { name },
          select: { id: true },
        })
      : await db.jobPosition.create({ data: { name }, select: { id: true } })

    revalidatePath("/job-positions")
    return ok(position)
  } catch (error) {
    return toActionResult(error, "upsertJobPosition")
  }
}
