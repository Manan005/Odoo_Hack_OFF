import { Role } from "@prisma/client"
import { EmployeeForm } from "@/components/employees/EmployeeForm"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { emptyEmployee } from "@/lib/form-defaults"

export const metadata = { title: "New Employee — PeoplePay360" }

export default async function NewEmployeePage() {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Only HR can create employee records." />

  const [departments, positions, managers, schedules] = await Promise.all([
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.jobPosition.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.employee
      .findMany({
        where: { active: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      })
      .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }))),
    db.workingSchedule.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <>
      <PageHeader
        title="New Employee"
        subtitle="The employee record is the hub contracts, attendance and payroll hang off."
      />
      <EmployeeForm
        initial={emptyEmployee}
        departments={departments}
        positions={positions}
        managers={managers}
        schedules={schedules}
      />
    </>
  )
}
