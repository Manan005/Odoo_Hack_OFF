import { Role } from "@prisma/client"
import { notFound } from "next/navigation"
import { ContractForm } from "@/components/contracts/ContractForm"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { formatINR } from "@/lib/money"
import { displayStatus } from "@/lib/payroll/contract-resolver"

const toDateInput = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "")

export default async function ContractDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const { id } = await params
  const contract = await db.contract.findUnique({
    where: { id },
    include: { employee: { select: { id: true, firstName: true, lastName: true } } },
  })
  if (!contract) notFound()

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  if (!isHr && contract.employeeId !== viewer.employeeId) {
    return <Forbidden message="You can only view your own contracts." />
  }

  const [employees, departments, positions, schedules, structures] = await Promise.all([
    isHr
      ? db.employee
          .findMany({
            where: { active: true },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: "asc" },
          })
          .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` })))
      : [],
    isHr ? db.department.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    isHr ? db.jobPosition.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }) : [],
    isHr
      ? db.workingSchedule.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
    isHr
      ? db.salaryStructure.findMany({
          where: { active: true },
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : [],
  ])

  const employeeName = `${contract.employee.firstName} ${contract.employee.lastName}`

  if (!isHr) {
    return (
      <>
        <FormHeader
          breadcrumb="My Contracts"
          backHref="/contracts"
          title={contract.reference}
          subtitle={employeeName}
          badge={<StatusBadge status={displayStatus(contract)} />}
        />
        <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
          <dl className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Wage / Month</dt>
              <dd className="mt-1 font-medium tabular">{formatINR(String(contract.wage))}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Period</dt>
              <dd className="mt-1 font-medium">
                {contract.startDate.toDateString()} —{" "}
                {contract.endDate ? contract.endDate.toDateString() : "open-ended"}
              </dd>
            </div>
          </dl>
        </div>
      </>
    )
  }

  return (
    <>
      <FormHeader
        breadcrumb="Contracts"
        backHref="/contracts"
        title={contract.reference}
        subtitle={`${employeeName} · ${formatINR(String(contract.wage))} per month`}
        badge={<StatusBadge status={displayStatus(contract)} />}
      />
      <ContractForm
        initial={{
          id: contract.id,
          reference: contract.reference,
          employeeId: contract.employeeId,
          startDate: toDateInput(contract.startDate),
          endDate: toDateInput(contract.endDate),
          wage: String(contract.wage),
          status: contract.status,
          departmentId: contract.departmentId ?? "",
          jobPositionId: contract.jobPositionId ?? "",
          workingScheduleId: contract.workingScheduleId ?? "",
          salaryStructureId: contract.salaryStructureId ?? "",
          notes: contract.notes ?? "",
        }}
        employees={employees}
        departments={departments}
        positions={positions}
        schedules={schedules}
        structures={structures}
      />
    </>
  )
}
