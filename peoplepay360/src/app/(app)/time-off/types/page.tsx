import { ApprovalMode, Role, TimeOffUnit } from "@prisma/client"
import { Settings2 } from "lucide-react"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/Forbidden"
import { ListToolbar } from "@/components/shared/ListToolbar"
import { PageHeader } from "@/components/shared/PageHeader"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { APPROVAL_LABEL, UNIT_LABEL } from "@/lib/validation/timeoff"

export const metadata = { title: "Time Off Types — PeoplePay360" }

type Row = {
  id: string
  name: string
  unit: TimeOffUnit
  requiresAllocation: boolean
  approvalMode: ApprovalMode
  isPaid: boolean
  active: boolean
  _count: { allocations: number; requests: number }
}

const columns: Column<Row>[] = [
  { key: "name", header: "Type", render: (r) => r.name },
  { key: "unit", header: "Unit", render: (r) => UNIT_LABEL[r.unit] },
  {
    key: "allocation",
    header: "Allocation",
    render: (r) =>
      r.requiresAllocation ? (
        <span className="font-medium text-primary">Required</span>
      ) : (
        <span className="text-muted-foreground">No</span>
      ),
  },
  { key: "approval", header: "Approval", render: (r) => APPROVAL_LABEL[r.approvalMode] },
  {
    key: "paid",
    header: "Paid",
    render: (r) => (r.isPaid ? "Yes" : <span className="text-warning">Unpaid</span>),
  },
  {
    key: "usage",
    header: "In Use",
    numeric: true,
    render: (r) => r._count.allocations + r._count.requests,
  },
  { key: "status", header: "Status", render: (r) => <ActiveBadge active={r.active} /> },
]

export default async function TimeOffTypesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Time off types are policy configuration, managed by HR." />

  const { q } = await searchParams

  const types = await db.timeOffType.findMany({
    where: {
      companyId: hr.companyId,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      unit: true,
      requiresAllocation: true,
      approvalMode: true,
      isPaid: true,
      active: true,
      _count: { select: { allocations: true, requests: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })

  return (
    <>
      <PageHeader
        title="Time Off Types"
        subtitle="Policy rules — the unit, whether an allocation is required, and the approval flow."
      />

      <ListToolbar newHref="/time-off/types/new" searchPlaceholder="Search time off types…" />

      <DataTable
        columns={columns}
        rows={types}
        rowKey={(r) => r.id}
        rowHref={(r) => `/time-off/types/${r.id}`}
        empty={
          <EmptyState
            icon={Settings2}
            title="No time off types yet"
            description="A type decides whether leave draws on an allocation and how it is approved."
          />
        }
        footer={<RowCount shown={types.length} total={types.length} />}
      />
    </>
  )
}
