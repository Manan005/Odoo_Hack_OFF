import { FileText, Receipt } from "lucide-react"
import { notFound } from "next/navigation"
import { ContractForm } from "@/components/contracts/ContractForm"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { SmartButtonBar, type SmartButton } from "@/components/shared/SmartButtonBar"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Surface } from "@/components/ui/surface"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtDate } from "@/lib/dates"
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

  // The payslips list scopes non-payroll viewers to themselves, so the button
  // is offered only where the link lands on the same employee it counts.
  const canOpenPayslips =
    rankOf(viewer.roles) >= ROLE_RANK.HR_PAYROLL_USER ||
    contract.employeeId === viewer.employeeId

  // Live counts (rules.md §6), one round-trip.
  const [employeeContracts, payslips] = await Promise.all([
    db.contract.count({ where: { employeeId: contract.employeeId } }),
    canOpenPayslips ? db.payslip.count({ where: { employeeId: contract.employeeId } }) : null,
  ])

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
  const status = displayStatus(contract)

  const smartButtons: SmartButton[] = [
    {
      label: "Employee contracts",
      count: employeeContracts,
      href: `/contracts?employeeId=${contract.employeeId}`,
      icon: FileText,
    },
  ]
  if (payslips !== null) {
    smartButtons.push({
      label: "Payslips",
      count: payslips,
      href: `/payroll/payslips?employeeId=${contract.employeeId}`,
      icon: Receipt,
    })
  }

  if (!isHr) {
    return (
      <>
        <FormHeader
          breadcrumb="My Contracts"
          backHref="/contracts"
          title={contract.reference}
          subtitle={employeeName}
          badge={<StatusBadge status={status} />}
          smartButtons={<SmartButtonBar buttons={smartButtons} />}
        />
        <Surface padded>
          <dl className="stagger grid grid-cols-1 gap-5 text-sm md:grid-cols-3">
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Wage / Month
              </dt>
              <dd className="mt-1">
                <NumberTicker
                  value={formatINR(String(contract.wage))}
                  className="font-display text-2xl font-semibold tracking-tight"
                />
              </dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Start
              </dt>
              <dd className="mt-1 font-medium tabular">{fmtDate(contract.startDate)}</dd>
            </div>
            <div>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                End
              </dt>
              <dd className="mt-1 font-medium tabular">
                {contract.endDate ? (
                  fmtDate(contract.endDate)
                ) : (
                  <span className="text-muted-foreground">open-ended</span>
                )}
              </dd>
            </div>
          </dl>
        </Surface>
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
        badge={<StatusBadge status={status} />}
        smartButtons={<SmartButtonBar buttons={smartButtons} />}
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
