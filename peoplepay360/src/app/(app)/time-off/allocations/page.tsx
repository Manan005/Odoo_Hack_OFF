import { RequestStatus, TimeOffUnit } from "@prisma/client"
import { Wallet } from "lucide-react"
import { RecordStats } from "@/components/employees/RecordStats"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ApprovalButtons } from "@/components/timeoff/ApprovalButtons"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { balanceOf } from "@/lib/timeoff/balance"
import { formatDuration } from "@/lib/money"
import { cn } from "@/lib/utils"
import { REQUEST_STATUS_LABEL } from "@/lib/validation/timeoff"

export const metadata = { title: "Time Off Allocations — PeoplePay360" }

type Row = {
  id: string
  allocated: unknown
  taken: unknown
  status: RequestStatus
  validityLabel: string | null
  employee: { firstName: string; lastName: string }
  type: { name: string; unit: TimeOffUnit }
}

const columnsFor = (isHr: boolean): Column<Row>[] => {
  const base: Column<Row>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (r) => `${r.employee.firstName} ${r.employee.lastName}`,
    },
    {
      key: "type",
      header: "Type",
      render: (r) => (
        <span>
          {r.type.name}
          {r.validityLabel && (
            <span className="block text-xs text-muted-foreground">{r.validityLabel}</span>
          )}
        </span>
      ),
    },
    {
      key: "allocated",
      header: "Allocated",
      numeric: true,
      render: (r) => formatDuration(String(r.allocated), r.type.unit),
    },
    {
      key: "taken",
      header: "Taken",
      numeric: true,
      render: (r) => formatDuration(String(r.taken), r.type.unit),
    },
    {
      key: "remaining",
      header: "Remaining",
      numeric: true,
      // Derived, never stored (BR-T5). The bar is the same figure as a share of
      // what was granted — presentation, not a new number.
      render: (r) => {
        const b = balanceOf(r)
        const exhausted = b.remaining <= 0
        const share = b.allocated > 0 ? Math.min(1, Math.max(0, b.remaining / b.allocated)) : 0
        return (
          <span className="inline-flex items-center justify-end gap-2.5">
            <span className={exhausted ? "font-medium text-warning" : "font-medium"}>
              {formatDuration(b.remaining, r.type.unit)}
            </span>
            <span
              aria-hidden
              className="block h-1.5 w-14 overflow-hidden rounded-full bg-surface-muted ring-1 ring-inset ring-border/50"
            >
              <span
                className={cn(
                  "block h-full origin-left rounded-full",
                  exhausted ? "bg-warning" : "bg-primary",
                )}
                style={{ transform: `scaleX(${share})` }}
              />
            </span>
          </span>
        )
      },
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ]

  if (isHr) {
    base.push({
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => <ApprovalButtons id={r.id} kind="allocation" status={r.status} />,
    })
  }
  return base
}

export default async function AllocationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; employeeId?: string; typeId?: string; status?: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  const { q, employeeId, typeId, status } = await searchParams

  const scopedEmployeeId = isHr ? employeeId : (viewer.employeeId ?? "__none__")
  const statusFilter = status && status in RequestStatus ? (status as RequestStatus) : undefined

  const [allocations, filterEmployee, filterType] = await Promise.all([
    db.timeOffAllocation.findMany({
      where: {
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        ...(typeId ? { typeId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(q
          ? {
              OR: [
                { employee: { firstName: { contains: q, mode: "insensitive" as const } } },
                { employee: { lastName: { contains: q, mode: "insensitive" as const } } },
                { type: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        allocated: true,
        taken: true,
        status: true,
        validityLabel: true,
        employee: { select: { firstName: true, lastName: true } },
        type: { select: { name: true, unit: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
    employeeId && isHr
      ? db.employee.findUnique({
          where: { id: employeeId },
          select: { firstName: true, lastName: true },
        })
      : null,
    typeId ? db.timeOffType.findUnique({ where: { id: typeId }, select: { name: true } }) : null,
  ])

  // Over the rows fetched above — nothing invented.
  const pending = allocations.filter((a) => a.status === RequestStatus.TO_APPROVE).length
  const approved = allocations.filter((a) => a.status === RequestStatus.APPROVED).length

  return (
    <>
      <PageHeader
        eyebrow="Time off"
        title="Time Off Allocations"
        subtitle="An approved allocation is what creates available leave balance."
      />

      <ListToolbar
        newHref={isHr ? "/time-off/allocations/new" : undefined}
        newLabel="New allocation"
        searchPlaceholder="Search allocations…"
        chips={
          <>
            {filterEmployee && (
              <FilterChip
                paramKey="employeeId"
                label={`Employee: ${filterEmployee.firstName} ${filterEmployee.lastName}`}
              />
            )}
            {filterType && <FilterChip paramKey="typeId" label={`Type: ${filterType.name}`} />}
            {statusFilter && (
              <FilterChip paramKey="status" label={`Status: ${REQUEST_STATUS_LABEL[statusFilter]}`} />
            )}
          </>
        }
      >
        <RecordStats
          stats={[
            { label: "to approve", value: pending, tone: "warning" },
            { label: "approved", value: approved, tone: "success" },
          ]}
        />
      </ListToolbar>

      <DataTable
        columns={columnsFor(isHr)}
        rows={allocations}
        rowKey={(r) => r.id}
        rowHref={(r) => `/time-off/allocations/${r.id}`}
        empty={
          <EmptyState
            icon={Wallet}
            title="No allocations yet"
            description="Grant a balance here before employees can request leave of a type that needs one."
          />
        }
        footer={<RowCount shown={allocations.length} total={allocations.length} />}
      />
    </>
  )
}
