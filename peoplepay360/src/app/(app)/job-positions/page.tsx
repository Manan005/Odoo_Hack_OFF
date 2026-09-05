import { Role } from "@prisma/client"
import { upsertJobPosition } from "@/actions/employee.actions"
import { SimpleNameList } from "@/components/employees/SimpleNameList"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "Job Positions — PeoplePay360" }

export default async function JobPositionsPage() {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Job positions are managed by HR." />

  const positions = await db.jobPosition.findMany({
    select: { id: true, name: true, _count: { select: { employees: true } } },
    orderBy: { name: "asc" },
  })

  return (
    <>
      <PageHeader
        title="Job Positions"
        subtitle="Positions appear on the employee record and on every contract."
      />
      <SimpleNameList
        entityLabel="Job Position"
        save={upsertJobPosition}
        rows={positions.map((p) => ({
          id: p.id,
          name: p.name,
          employeeCount: p._count.employees,
        }))}
      />
    </>
  )
}
