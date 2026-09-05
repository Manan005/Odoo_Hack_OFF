import { RequestStatus } from "@prisma/client"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ApprovalButtons } from "@/components/timeoff/ApprovalButtons"
import {
  RequestForm,
  type RemainingByEmployee,
  type TypeOption,
} from "@/components/timeoff/RequestForm"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { balanceOf } from "@/lib/timeoff/balance"
import { formatDuration } from "@/lib/money"

const toDateInput = (d: Date) => d.toISOString().slice(0, 10)

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const { id } = await params
  const request = await db.timeOffRequest.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, firstName: true, lastName: true } },
      type: { select: { id: true, name: true, unit: true, requiresAllocation: true } },
      approver: { select: { firstName: true, lastName: true } },
      allocation: {
        select: { id: true, allocated: true, taken: true, validityLabel: true },
      },
    },
  })
  if (!request) notFound()

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  if (!isHr && request.employeeId !== viewer.employeeId) {
    return <Forbidden message="You can only view your own time off requests." />
  }

  const types: TypeOption[] = await db.timeOffType.findMany({
    where: { active: true },
    select: { id: true, name: true, unit: true, requiresAllocation: true },
    orderBy: { name: "asc" },
  })

  // The employee is fixed on an existing request, so one entry is enough.
  const allocations = await db.timeOffAllocation.findMany({
    where: { employeeId: request.employeeId, status: RequestStatus.APPROVED },
    select: { typeId: true, allocated: true, taken: true },
  })
  const remaining: RemainingByEmployee = {}
  for (const a of allocations) {
    const perType = (remaining[request.employeeId] ??= {})
    perType[a.typeId] = Number(
      ((perType[a.typeId] ?? 0) + balanceOf(a).remaining).toFixed(2),
    )
  }

  const employeeName = `${request.employee.firstName} ${request.employee.lastName}`
  const allocationLabel = request.allocation
    ? `${request.allocation.validityLabel ?? request.type.name} — ${formatDuration(
        balanceOf(request.allocation).remaining,
        request.type.unit,
      )} remaining`
    : null

  // Editing an approved request would desync its consumed balance; refuse first.
  const editable = isHr && request.status !== RequestStatus.APPROVED

  return (
    <>
      <FormHeader
        breadcrumb="Time Off Requests"
        backHref="/time-off/requests"
        title={`${request.type.name} — ${employeeName}`}
        subtitle={
          [
            formatDuration(String(request.duration), request.type.unit),
            request.approver
              ? `Approver: ${request.approver.firstName} ${request.approver.lastName}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        }
        badge={<StatusBadge status={request.status} />}
        actions={
          isHr ? (
            <ApprovalButtons id={request.id} kind="request" status={request.status} size="md" />
          ) : undefined
        }
      />

      {isHr && request.status === RequestStatus.APPROVED && (
        <p className="mb-5 rounded-md bg-warning-subtle px-4 py-3 text-xs text-warning">
          This request is approved and its balance is consumed. Refuse it first to edit the dates.
        </p>
      )}

      <RequestForm
        initial={{
          id: request.id,
          employeeId: request.employeeId,
          typeId: request.typeId,
          startDate: toDateInput(request.startDate),
          endDate: toDateInput(request.endDate),
          reason: request.reason ?? "",
        }}
        employees={[{ id: request.employee.id, name: employeeName }]}
        types={types}
        remaining={remaining}
        duration={formatDuration(String(request.duration), request.type.unit)}
        allocationLabel={allocationLabel}
        readOnly={!editable}
      />
    </>
  )
}
