import { Role } from "@prisma/client"
import { CalendarClock, Clock, FileText, Plane, Wallet } from "lucide-react"
import { notFound, redirect } from "next/navigation"
import {
  EmployeeForm,
  type EmployeeFormValues,
} from "@/components/employees/EmployeeForm"
import { FormHeader } from "@/components/shared/FormHeader"
import { SmartButtonBar } from "@/components/shared/SmartButtonBar"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "")

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

  return (
    <>
      <FormHeader
        breadcrumb={isHr ? "Employees" : "My workspace"}
        backHref={isHr ? "/employees" : "/"}
        title={name}
        subtitle={
          [employee.jobPosition?.name, employee.department?.name].filter(Boolean).join(" • ") ||
          undefined
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

      {employee.workingSchedule && (
        <p className="mb-4 inline-flex items-center gap-1.5 rounded-md bg-surface-muted px-2.5 py-1 text-xs text-muted-foreground">
          <CalendarClock className="h-3.5 w-3.5" />
          Working schedule: {employee.workingSchedule.name}
        </p>
      )}

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
