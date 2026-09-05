import { Role } from "@prisma/client"
import { auth } from "@/auth"
import { AuthError } from "@/lib/result"

export interface SessionUser {
  id: string
  email: string
  name: string
  roles: Role[]
  employeeId: string | null
  companyId: string
}

/**
 * Roles are ranked so "X and above" checks stay in one place.
 * A user may hold several roles — rank is the highest they hold.
 */
export const ROLE_RANK: Record<Role, number> = {
  EMPLOYEE: 0,
  HR_MANAGER: 1,
  HR_PAYROLL_USER: 2,
  HR_PAYROLL_MANAGER: 3,
  ADMIN: 4,
}

export const ROLE_LABEL: Record<Role, string> = {
  EMPLOYEE: "Employee",
  HR_MANAGER: "HR Manager",
  HR_PAYROLL_USER: "HR Payroll User",
  HR_PAYROLL_MANAGER: "HR Payroll Manager",
  ADMIN: "Admin",
}

export const rankOf = (roles: Role[]): number =>
  roles.reduce((max, r) => Math.max(max, ROLE_RANK[r] ?? 0), 0)

// ───────────────────────────── Guards ─────────────────────────────
// Every Server Action starts with one of these. Hiding a nav item is not
// a permission check — see rules.md §4.

export async function requireAuth(): Promise<SessionUser> {
  const session = await auth()
  if (!session?.user) throw new AuthError("UNAUTHENTICATED", "You must sign in to continue.")
  return session.user as SessionUser
}

export async function requireRole(min: Role): Promise<SessionUser> {
  const user = await requireAuth()
  if (rankOf(user.roles) < ROLE_RANK[min]) {
    throw new AuthError(
      "FORBIDDEN",
      `This action requires ${ROLE_LABEL[min]} access or higher.`,
    )
  }
  return user
}

export async function requireAnyRole(roles: Role[]): Promise<SessionUser> {
  const user = await requireAuth()
  if (!user.roles.some((r) => roles.includes(r))) {
    throw new AuthError(
      "FORBIDDEN",
      `This action requires one of: ${roles.map((r) => ROLE_LABEL[r]).join(", ")}.`,
    )
  }
  return user
}

/**
 * EMPLOYEE-role users may act on their own employee record; anyone at `min`
 * or above may act on anyone's.
 */
export async function requireSelfOrRole(
  employeeId: string,
  min: Role,
): Promise<SessionUser> {
  const user = await requireAuth()
  if (user.employeeId === employeeId) return user
  if (rankOf(user.roles) >= ROLE_RANK[min]) return user
  throw new AuthError("FORBIDDEN", "You can only access your own records.")
}

// ───────────────────────── Capability helpers ─────────────────────────

export const isAdmin = (u: SessionUser): boolean => u.roles.includes(Role.ADMIN)

export const canManageHr = (u: SessionUser): boolean =>
  rankOf(u.roles) >= ROLE_RANK.HR_MANAGER

export const canAccessPayroll = (u: SessionUser): boolean =>
  rankOf(u.roles) >= ROLE_RANK.HR_PAYROLL_USER

export const canEditSalaryConfig = (u: SessionUser): boolean =>
  rankOf(u.roles) >= ROLE_RANK.HR_PAYROLL_MANAGER

/** EMPLOYEE-only users see just their own rows — narrow the `where`, never the result. */
export const isSelfScoped = (u: SessionUser): boolean =>
  rankOf(u.roles) < ROLE_RANK.HR_MANAGER
