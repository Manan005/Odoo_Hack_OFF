import { Role } from "@prisma/client"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { AllocationForm, emptyAllocation } from "@/components/timeoff/AllocationForm"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "New Allocation — PeoplePay360" }

export default async function NewAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string; typeId?: string }>
}) {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Allocations are granted by HR." />

  const { employeeId, typeId } = await searchParams

  const [employees, types] = await Promise.all([
    db.employee
      .findMany({
        where: { active: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      })
      .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }))),
    db.timeOffType.findMany({
      where: { active: true, companyId: hr.companyId },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <>
      <PageHeader
        title="New Allocation"
        subtitle="Grants leave balance. It must be approved before an employee can draw on it."
      />
      <AllocationForm
        initial={{
          ...emptyAllocation,
          employeeId: employeeId ?? "",
          typeId: typeId ?? "",
        }}
        employees={employees}
        types={types}
      />
    </>
  )
}
