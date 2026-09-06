import { ApprovalMode, Role, TimeOffUnit } from "@prisma/client"
import { Settings2 } from "lucide-react"
import { RecordStats } from "@/components/employees/RecordStats"
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

function CountChip({ value, noun }: { value: number; noun: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-1.5 py-0.5 text-xs ring-1 ring-inset ring-border/60">
      <span className="font-semibold tabular">{value}</span>
      <span className="text-muted-foreground">{noun}</span>
    </span>
  )
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
        <span className="text-muted-foreground">Not required</span>
      ),
  },
  { key: "approval", header: "Approval", render: (r) => APPROVAL_LABEL[r.approvalMode] },
  {
    key: "paid",
    header: "Paid",
    render: (r) => (r.isPaid ? "Paid" : <span className="font-medium text-warning">Unpaid</span>),
  },
  {
    key: "usage",
    header: "In Use",
    numeric: true,
    // Both figures are the `_count` the page fetched, shown apart rather than
    // summed so each reads as what it is.
    render: (r) => (
      <span className="inline-flex items-center justify-end gap-1.5">
        <CountChip value={r._count.allocations} noun="allocations" />
        <CountChip value={r._count.requests} noun="requests" />
      </span>
    ),
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

  const activeCount = types.filter((t) => t.active).length

  return (
    <>
      <PageHeader
        eyebrow="Time off"
        title="Time Off Types"
        subtitle="Policy rules — the unit, whether an allocation is required, and the approval flow."
      />

      <ListToolbar
        newHref="/time-off/types/new"
        newLabel="New type"
        searchPlaceholder="Search time off types…"
      >
        <RecordStats
          stats={[
            { label: "types", value: types.length, tone: "primary" },
            { label: "active", value: activeCount, tone: "success" },
          ]}
        />
      </ListToolbar>

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
