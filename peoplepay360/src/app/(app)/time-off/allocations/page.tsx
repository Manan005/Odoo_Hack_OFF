import { RequestStatus, TimeOffUnit } from "@prisma/client"
import { Wallet } from "lucide-react"
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
    { key: "type", header: "Type", render: (r) => r.type.name },
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
      // Derived, never stored (BR-T5).
      render: (r) => {
        const b = balanceOf(r)
        return (
          <span className={b.remaining <= 0 ? "text-warning" : "font-medium"}>
            {formatDuration(b.remaining, r.type.unit)}
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

  const [allocations, filterEmployee, filterType] = await Promise.all([
    db.timeOffAllocation.findMany({
      where: {
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        ...(typeId ? { typeId } : {}),
        ...(status && status in RequestStatus ? { status: status as RequestStatus } : {}),
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

  return (
    <>
      <PageHeader
        title="Time Off Allocations"
        subtitle="An approved allocation is what creates available leave balance."
      />

      <ListToolbar
        newHref={isHr ? "/time-off/allocations/new" : undefined}
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
            {status && <FilterChip paramKey="status" label={`Status: ${status}`} />}
          </>
        }
      />

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
