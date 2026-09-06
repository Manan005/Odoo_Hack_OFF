import { Role } from "@prisma/client"
import { upsertDepartment } from "@/actions/employee.actions"
import { RecordStats } from "@/components/employees/RecordStats"
import { SimpleNameList } from "@/components/employees/SimpleNameList"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "Departments — PeoplePay360" }

export default async function DepartmentsPage() {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Departments are managed by HR." />

  const [departments, managers] = await Promise.all([
    db.department.findMany({
      where: { companyId: hr.companyId },
      select: {
        id: true,
        name: true,
        managerId: true,
        manager: { select: { firstName: true, lastName: true } },
        _count: { select: { employees: true } },
      },
      orderBy: { name: "asc" },
    }),
    db.employee
      .findMany({
        where: { active: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      })
      .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }))),
  ])

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Departments"
        subtitle="Departments group employees for reporting and dashboard breakdowns."
        actions={
          <RecordStats stats={[{ label: "departments", value: departments.length, tone: "primary" }]} />
        }
      />
      <SimpleNameList
        entityLabel="Department"
        managers={managers}
        save={upsertDepartment}
        countHrefBase="/employees?departmentId="
        rows={departments.map((d) => ({
          id: d.id,
          name: d.name,
          managerId: d.managerId,
          managerName: d.manager ? `${d.manager.firstName} ${d.manager.lastName}` : null,
          employeeCount: d._count.employees,
        }))}
      />
    </>
  )
}
