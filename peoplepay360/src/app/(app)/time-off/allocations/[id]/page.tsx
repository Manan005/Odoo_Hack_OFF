import { RequestStatus } from "@prisma/client"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { AllocationForm } from "@/components/timeoff/AllocationForm"
import { ApprovalButtons } from "@/components/timeoff/ApprovalButtons"
import { Surface } from "@/components/ui/surface"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { balanceOf } from "@/lib/timeoff/balance"
import { formatDuration } from "@/lib/money"

export default async function AllocationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const { id } = await params
  const allocation = await db.timeOffAllocation.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      type: { select: { id: true, name: true, unit: true } },
      approver: { select: { firstName: true, lastName: true } },
      requests: {
        where: { status: RequestStatus.APPROVED },
        select: { id: true, startDate: true, endDate: true, duration: true },
        orderBy: { startDate: "desc" },
      },
    },
  })
  if (!allocation) notFound()

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  if (!isHr && allocation.employeeId !== viewer.employeeId) {
    return <Forbidden message="You can only view your own allocations." />
  }

  const [employees, types] = await Promise.all([
    isHr
      ? db.employee
          .findMany({
            where: { active: true },
            select: { id: true, firstName: true, lastName: true },
            orderBy: { firstName: "asc" },
          })
          .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` })))
      : [
          {
            id: allocation.employee.id,
            name: `${allocation.employee.firstName} ${allocation.employee.lastName}`,
          },
        ],
    db.timeOffType.findMany({
      where: { active: true },
      select: { id: true, name: true, unit: true },
      orderBy: { name: "asc" },
    }),
  ])

  const balance = balanceOf(allocation)
  const employeeName = `${allocation.employee.firstName} ${allocation.employee.lastName}`

  return (
    <>
      <FormHeader
        breadcrumb="Allocations"
        backHref="/time-off/allocations"
        title={`${allocation.type.name} — ${employeeName}`}
        subtitle={
          [
            `${formatDuration(balance.allocated, allocation.type.unit)} allocated`,
            `${formatDuration(balance.taken, allocation.type.unit)} taken`,
            `${formatDuration(balance.remaining, allocation.type.unit)} remaining`,
            allocation.approver
              ? `Approver: ${allocation.approver.firstName} ${allocation.approver.lastName}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        }
        badge={<StatusBadge status={allocation.status} />}
        actions={
          isHr ? (
            <ApprovalButtons id={allocation.id} kind="allocation" status={allocation.status} size="md" />
          ) : undefined
        }
      />

      <div className="space-y-5">
        <AllocationForm
          initial={{
            id: allocation.id,
            employeeId: allocation.employeeId,
            typeId: allocation.typeId,
            allocated: String(allocation.allocated),
            validityLabel: allocation.validityLabel ?? "",
            description: allocation.description ?? "",
          }}
          employees={employees}
          types={types}
          taken={String(allocation.taken)}
          unit={allocation.type.unit}
          readOnly={!isHr}
        />

        {allocation.requests.length > 0 && (
          <Surface as="section" padded>
            <h2 className="mb-3 border-b border-border/70 pb-3 text-[15px] font-semibold tracking-tight">
              Approved requests drawing on this allocation
            </h2>
            <ul className="stagger-rows divide-y divide-border/60 text-sm">
              {allocation.requests.map((r) => (
                <li key={r.id} className="flex items-center justify-between py-2">
                  <span className="tabular">
                    {r.startDate.toISOString().slice(0, 10)}
                    <span className="text-subtle-foreground"> → </span>
                    {r.endDate.toISOString().slice(0, 10)}
                  </span>
                  <span className="tabular font-medium">
                    {formatDuration(String(r.duration), allocation.type.unit)}
                  </span>
                </li>
              ))}
            </ul>
          </Surface>
        )}
      </div>
    </>
  )
}
