"use server"

import { Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import { revalidatePath } from "next/cache"
import { requireRole } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { AuthError, ok, toActionResult, type ActionResult } from "@/lib/result"
import { createUserSchema, updateUserSchema } from "@/lib/validation/user"

/**
 * A user must never be able to grant themselves privileges (AC-M0-2).
 * Two independent rules, both enforced here on the server:
 *   1. You cannot change your own roles at all.
 *   2. Only an ADMIN can hand out ADMIN.
 */
function assertRoleAssignmentAllowed(
  actorId: string,
  actorRoles: Role[],
  targetUserId: string | null,
  nextRoles: Role[],
  currentRoles: Role[] | null,
) {
  const isSelf = targetUserId !== null && targetUserId === actorId
  const rolesChanged =
    currentRoles === null ||
    nextRoles.length !== currentRoles.length ||
    nextRoles.some((r) => !currentRoles.includes(r))

  if (isSelf && rolesChanged) {
    throw new AuthError(
      "SELF_ROLE_CHANGE",
      "You cannot change your own roles. Ask another administrator.",
      { roles: "You cannot change your own roles." },
    )
  }

  if (nextRoles.includes(Role.ADMIN) && !actorRoles.includes(Role.ADMIN)) {
    throw new AuthError("ADMIN_GRANT_DENIED", "Only an administrator can grant the Admin role.", {
      roles: "Only an administrator can grant the Admin role.",
    })
  }
}

export async function createUser(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.ADMIN)
    const input = createUserSchema.parse(raw)

    assertRoleAssignmentAllowed(actor.id, actor.roles, null, input.roles, null)

    const employee = await db.employee.findUnique({
      where: { id: input.employeeId },
      include: { user: { select: { id: true } } },
    })
    if (!employee) {
      throw new AuthError("EMPLOYEE_NOT_FOUND", "That employee no longer exists.", {
        employeeId: "Employee not found.",
      })
    }
    if (employee.user) {
      throw new AuthError("USER_EXISTS", `${employee.firstName} already has a user account.`, {
        employeeId: "This employee already has a login.",
      })
    }

    const email = input.email.toLowerCase()
    const clash = await db.user.findUnique({ where: { email } })
    if (clash) {
      throw new AuthError("EMAIL_TAKEN", "That email is already in use.", {
        email: "Email already in use.",
      })
    }

    const user = await db.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(input.password, 10),
        roles: input.roles,
        active: input.active,
        employeeId: input.employeeId,
      },
      select: { id: true },
    })

    revalidatePath("/users")
    return ok(user)
  } catch (error) {
    return toActionResult(error, "createUser")
  }
}

export async function updateUser(raw: unknown): Promise<ActionResult<{ id: string }>> {
  try {
    const actor = await requireRole(Role.ADMIN)
    const input = updateUserSchema.parse(raw)

    const existing = await db.user.findUnique({
      where: { id: input.userId },
      select: { id: true, roles: true, email: true },
    })
    if (!existing) {
      throw new AuthError("USER_NOT_FOUND", "That user no longer exists.")
    }

    assertRoleAssignmentAllowed(
      actor.id,
      actor.roles,
      existing.id,
      input.roles,
      existing.roles,
    )

    // An admin locking themselves out is a support ticket, not a feature.
    if (existing.id === actor.id && !input.active) {
      throw new AuthError("SELF_DEACTIVATE", "You cannot deactivate your own account.", {
        active: "You cannot deactivate yourself.",
      })
    }

    const email = input.email.toLowerCase()
    if (email !== existing.email) {
      const clash = await db.user.findUnique({ where: { email } })
      if (clash) {
        throw new AuthError("EMAIL_TAKEN", "That email is already in use.", {
          email: "Email already in use.",
        })
      }
    }

    const user = await db.user.update({
      where: { id: input.userId },
      data: {
        email,
        roles: input.roles,
        active: input.active,
        ...(input.password ? { passwordHash: await bcrypt.hash(input.password, 10) } : {}),
      },
      select: { id: true },
    })

    revalidatePath("/users")
    revalidatePath(`/users/${user.id}`)
    return ok(user)
  } catch (error) {
    return toActionResult(error, "updateUser")
  }
}
