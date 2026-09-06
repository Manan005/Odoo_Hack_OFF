import {
  Briefcase,
  Building2,
  CalendarClock,
  Clock,
  FileText,
  Plane,
  UserRound,
  Wallet,
  type LucideIcon,
} from "lucide-react"
import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import {
  EmployeeForm,
  type EmployeeFormValues,
} from "@/components/employees/EmployeeForm"
import { Spotlight } from "@/components/motion/Spotlight"
import { FormHeader } from "@/components/shared/FormHeader"
import { SmartButtonBar } from "@/components/shared/SmartButtonBar"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "")

interface InfoTile {
  label: string
  value: string | null
  icon: LucideIcon
  href: string | null
}

/**
 * The four relationships an employee record hangs off, as cursor-lit tiles.
 * Each opens the related record or the roster filtered to it; nothing here
 * is a count, so nothing needs a query.
 */
function InfoTiles({ tiles }: { tiles: InfoTile[] }) {
  return (
    <div className="stagger mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {tiles.map((t) => {
        const Icon = t.icon
        const inner = (
          <>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface-muted text-muted-foreground ring-1 ring-inset ring-border/60 transition-colors duration-200 group-hover:bg-primary-subtle group-hover:text-primary">
              <Icon className="h-4 w-4" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {t.label}
              </span>
              <span className="block truncate text-sm font-medium">
                {t.value ?? <span className="font-normal text-muted-foreground">—</span>}
              </span>
            </span>
          </>
        )
        return (
          // The stagger entrance lives on this wrapper so the tile's own hover
          // transform is not pinned by the animation's fill-mode.
          <div key={t.label} className="min-w-0">
            <Spotlight
              className={
                "group relative h-full overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-card " +
                "transition-[transform,box-shadow,border-color] duration-200 ease-out-quart " +
                (t.href ? "hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raise" : "")
              }
            >
              {t.href ? (
                <Link
                  href={t.href}
                  className="flex items-center gap-3 rounded-2xl p-3.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                >
                  {inner}
                </Link>
              ) : (
                <div className="flex items-center gap-3 p-3.5">{inner}</div>
              )}
            </Spotlight>
          </div>
        )
      })}
    </div>
  )
}

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) redirect("/login")

  const { id: rawId } = await params
  // `/employees/me` is the EMPLOYEE landing route.
  const id = rawId === "me" ? viewer.employeeId : rawId
  if (!id) notFound()

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  // An employee may open their own record; anyone else needs HR rank (AC-M1-4).
  if (!isHr && viewer.employeeId !== id) {
    redirect(viewer.employeeId ? `/employees/${viewer.employeeId}` : "/login")
  }

  const employee = await db.employee.findUnique({
    where: { id },
    include: {
      department: { select: { id: true, name: true } },
      jobPosition: { select: { id: true, name: true } },
      manager: { select: { id: true, firstName: true, lastName: true } },
      workingSchedule: { select: { id: true, name: true } },
    },
  })
  if (!employee) notFound()

  // Smart-button counts are live queries (AC-M1-2), batched into one round-trip.
  const [contracts, attendance, timeOff, allocations] = await Promise.all([
    db.contract.count({ where: { employeeId: id } }),
    db.attendance.count({ where: { employeeId: id } }),
    db.timeOffRequest.count({ where: { employeeId: id } }),
    db.timeOffAllocation.count({ where: { employeeId: id } }),
  ])

  const [departments, positions, managers, schedules] = await Promise.all([
    isHr
      ? db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [],
    isHr
      ? db.jobPosition.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
      : [],
    isHr
      ? db.employee
          .findMany({
            where: { active: true },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: "asc" },
          })
          .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` })))
      : [],
    isHr
      ? db.workingSchedule.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ])

  const name = `${employee.firstName} ${employee.lastName}`
  const initials = `${employee.firstName[0] ?? ""}${employee.lastName[0] ?? ""}`.toUpperCase()

  const initial: EmployeeFormValues = {
    id: employee.id,
    employeeCode: employee.employeeCode,
    firstName: employee.firstName,
    lastName: employee.lastName,
    workEmail: employee.workEmail ?? "",
    workPhone: employee.workPhone ?? "",
    employeeType: employee.employeeType,
    workLocation: employee.workLocation ?? "",
    departmentId: employee.departmentId ?? "",
    jobPositionId: employee.jobPositionId ?? "",
    managerId: employee.managerId ?? "",
    workingScheduleId: employee.workingScheduleId ?? "",
    active: employee.active,
    personalEmail: employee.personalEmail ?? "",
    personalPhone: employee.personalPhone ?? "",
    dateOfBirth: toDateInput(employee.dateOfBirth),
    gender: employee.gender ?? "",
    address: employee.address ?? "",
    emergencyContactName: employee.emergencyContactName ?? "",
    emergencyContactPhone: employee.emergencyContactPhone ?? "",
    bankAccountNumber: employee.bankAccountNumber ?? "",
    bankName: employee.bankName ?? "",
    bankIfsc: employee.bankIfsc ?? "",
    joiningDate: toDateInput(employee.joiningDate),
  }

  // Links only where the target list exists and the viewer may open it.
  const tiles: InfoTile[] = [
    {
      label: "Department",
      value: employee.department?.name ?? null,
      icon: Building2,
      href: isHr && employee.department ? `/employees?departmentId=${employee.department.id}` : null,
    },
    {
      label: "Job position",
      value: employee.jobPosition?.name ?? null,
      icon: Briefcase,
      href:
        isHr && employee.jobPosition ? `/employees?jobPositionId=${employee.jobPosition.id}` : null,
    },
    {
      label: "Manager",
      value: employee.manager
        ? `${employee.manager.firstName} ${employee.manager.lastName}`
        : null,
      icon: UserRound,
      href: isHr && employee.manager ? `/employees/${employee.manager.id}` : null,
    },
    {
      label: "Working schedule",
      value: employee.workingSchedule?.name ?? null,
      icon: CalendarClock,
      href:
        isHr && employee.workingSchedule
          ? `/working-schedules/${employee.workingSchedule.id}`
          : null,
    },
  ]

  return (
    <>
      <FormHeader
        breadcrumb={isHr ? "Employees" : "My workspace"}
        backHref={isHr ? "/employees" : "/"}
        title={name}
        subtitle={
          [employee.employeeCode, employee.jobPosition?.name, employee.department?.name]
            .filter(Boolean)
            .join(" • ") || undefined
        }
        avatar={initials}
        badge={<ActiveBadge active={employee.active} />}
        smartButtons={
          <SmartButtonBar
            buttons={[
              {
                label: "Contracts",
                count: contracts,
                href: `/contracts?employeeId=${id}`,
                icon: FileText,
              },
              {
                label: "Attendance",
                count: attendance,
                href: `/attendance?employeeId=${id}`,
                icon: Clock,
              },
              {
                label: "Time Off",
                count: timeOff,
                href: `/time-off/requests?employeeId=${id}`,
                icon: Plane,
              },
              {
                label: "Allocations",
                count: allocations,
                href: `/time-off/allocations?employeeId=${id}`,
                icon: Wallet,
              },
            ]}
          />
        }
      />

      <InfoTiles tiles={tiles} />

      <EmployeeForm
        initial={initial}
        departments={departments}
        positions={positions}
        managers={managers}
        schedules={schedules}
        readOnly={!isHr}
      />
    </>
  )
}
