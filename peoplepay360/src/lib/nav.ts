import { Role } from "@prisma/client"
import { ROLE_RANK, rankOf, type SessionUser } from "@/lib/auth-guard"

export interface NavItem {
  label: string
  href: string
  /** Minimum role rank required to see this entry. */
  min: Role
  children?: NavItem[]
}

/**
 * Nav visibility per PRD §2.3. This is presentation only — hiding an item is
 * never the security boundary (rules.md §4).
 */
const NAV: NavItem[] = [
  {
    label: "Employees",
    href: "/employees",
    min: Role.HR_MANAGER,
    children: [
      { label: "Employees", href: "/employees", min: Role.HR_MANAGER },
      { label: "Departments", href: "/departments", min: Role.HR_MANAGER },
      { label: "Job Positions", href: "/job-positions", min: Role.HR_MANAGER },
    ],
  },
  {
    label: "Contracts",
    href: "/contracts",
    min: Role.HR_MANAGER,
    children: [
      { label: "Contracts", href: "/contracts", min: Role.HR_MANAGER },
      { label: "Working Schedules", href: "/working-schedules", min: Role.HR_MANAGER },
    ],
  },
  { label: "Attendance", href: "/attendance", min: Role.EMPLOYEE },
  {
    label: "Time Off",
    href: "/time-off/requests",
    min: Role.EMPLOYEE,
    children: [
      { label: "Requests", href: "/time-off/requests", min: Role.EMPLOYEE },
      { label: "Allocations", href: "/time-off/allocations", min: Role.EMPLOYEE },
      { label: "Time Off Types", href: "/time-off/types", min: Role.HR_MANAGER },
    ],
  },
  {
    label: "Payroll",
    href: "/payroll/dashboard",
    min: Role.HR_PAYROLL_USER,
    children: [
      { label: "Dashboard", href: "/payroll/dashboard", min: Role.HR_PAYROLL_USER },
      { label: "Payruns", href: "/payroll/payruns", min: Role.HR_PAYROLL_USER },
      { label: "Payslips", href: "/payroll/payslips", min: Role.HR_PAYROLL_USER },
      { label: "Simulator", href: "/payroll/simulator", min: Role.HR_PAYROLL_USER },
      { label: "Structures", href: "/payroll/structures", min: Role.HR_PAYROLL_USER },
      { label: "Rules", href: "/payroll/rules", min: Role.HR_PAYROLL_USER },
    ],
  },
  { label: "User Management", href: "/users", min: Role.ADMIN },
]

/** EMPLOYEE-only users get a self-service nav rather than the HR nav. */
const EMPLOYEE_NAV: NavItem[] = [
  { label: "My Profile", href: "/employees/me", min: Role.EMPLOYEE },
  { label: "Attendance", href: "/attendance", min: Role.EMPLOYEE },
  {
    label: "Time Off",
    href: "/time-off/requests",
    min: Role.EMPLOYEE,
    children: [
      { label: "Requests", href: "/time-off/requests", min: Role.EMPLOYEE },
      { label: "Allocations", href: "/time-off/allocations", min: Role.EMPLOYEE },
    ],
  },
  { label: "My Payslips", href: "/payroll/payslips", min: Role.EMPLOYEE },
]

export function navFor(user: SessionUser): NavItem[] {
  const rank = rankOf(user.roles)
  if (rank < ROLE_RANK.HR_MANAGER) return EMPLOYEE_NAV

  const visible = (items: NavItem[]): NavItem[] =>
    items
      .filter((i) => rank >= ROLE_RANK[i.min])
      .map((i) => (i.children ? { ...i, children: visible(i.children) } : i))
      .filter((i) => !i.children || i.children.length > 0)

  return visible(NAV)
}

/** Where a user lands after sign-in, by rank. */
export function landingFor(user: SessionUser): string {
  const rank = rankOf(user.roles)
  if (rank >= ROLE_RANK.HR_PAYROLL_USER) return "/payroll/dashboard"
  if (rank >= ROLE_RANK.HR_MANAGER) return "/employees"
  return "/employees/me"
}
