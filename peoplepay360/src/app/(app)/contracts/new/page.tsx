import { Role } from "@prisma/client"
import { ContractForm } from "@/components/contracts/ContractForm"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { emptyContract } from "@/lib/form-defaults"

export const metadata = { title: "New Contract — PeoplePay360" }

export default async function NewContractPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>
}) {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Contracts are managed by HR." />

  const { employeeId } = await searchParams

  const [employees, departments, positions, schedules, structures] = await Promise.all([
    db.employee
      .findMany({
        where: { active: true },
        select: { id: true, firstName: true, lastName: true },
        orderBy: { firstName: "asc" },
      })
      .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` }))),
    db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.jobPosition.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    db.workingSchedule.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.salaryStructure.findMany({
      where: { active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <>
      <PageHeader
        title="New Contract"
        subtitle="An employee cannot hold two running contracts covering the same period."
      />
      <ContractForm
        initial={{ ...emptyContract, employeeId: employeeId ?? "" }}
        employees={employees}
        departments={departments}
        positions={positions}
        schedules={schedules}
        structures={structures}
      />
    </>
  )
}
