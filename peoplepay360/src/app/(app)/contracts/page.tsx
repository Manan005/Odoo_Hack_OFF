import { ContractStatus } from "@prisma/client"
import { FileText } from "lucide-react"
import { RecordStats } from "@/components/employees/RecordStats"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtDateCompact } from "@/lib/dates"
import { formatMoneyCompact } from "@/lib/money"
import { displayStatus } from "@/lib/payroll/contract-resolver"
import { CONTRACT_STATUS_LABEL } from "@/lib/validation/contract"

export const metadata = { title: "Contracts — PeoplePay360" }

type Row = {
  id: string
  reference: string
  startDate: Date
  endDate: Date | null
  wage: unknown
  status: ContractStatus
  employee: { id: string; firstName: string; lastName: string }
}

const columns: Column<Row>[] = [
  {
    key: "reference",
    header: "Contract",
    render: (r) => <span className="font-mono text-[13px]">{r.reference}</span>,
  },
  {
    key: "employee",
    header: "Employee",
    render: (r) => `${r.employee.firstName} ${r.employee.lastName}`,
  },
  { key: "start", header: "Start", className: "tabular", render: (r) => fmtDateCompact(r.startDate) },
  {
    key: "end",
    header: "End",
    className: "tabular",
    render: (r) =>
      r.endDate ? fmtDateCompact(r.endDate) : <span className="text-muted-foreground">open-ended</span>,
  },
  {
    key: "wage",
    header: "Wage / Month",
    numeric: true,
    render: (r) => <span className="font-medium">{formatMoneyCompact(String(r.wage))}</span>,
  },
  {
    key: "status",
    header: "Status",
    // BR-C4: a past end date reads as Expired without a background job.
    render: (r) => <StatusBadge status={displayStatus(r)} />,
  },
]

export default async function ContractsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; employeeId?: string; status?: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  const { q, employeeId, status } = await searchParams

  // EMPLOYEE rank sees only their own contracts — narrowed in the where clause.
  const scopedEmployeeId = isHr ? employeeId : (viewer.employeeId ?? "__none__")

  const [contracts, filterEmployee] = await Promise.all([
    db.contract.findMany({
      where: {
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        ...(status && status in ContractStatus ? { status: status as ContractStatus } : {}),
        ...(q
          ? {
              OR: [
                { reference: { contains: q, mode: "insensitive" as const } },
                { employee: { firstName: { contains: q, mode: "insensitive" as const } } },
                { employee: { lastName: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        reference: true,
        startDate: true,
        endDate: true,
        wage: true,
        status: true,
        employee: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: [{ startDate: "desc" }],
    }),
    employeeId && isHr
      ? db.employee.findUnique({
          where: { id: employeeId },
          select: { firstName: true, lastName: true },
        })
      : null,
  ])

  // Counted over the rows fetched above, with BR-C4 applied — nothing invented.
  const running = contracts.filter((c) => displayStatus(c) === ContractStatus.RUNNING).length
  const statusLabel =
    status && status in ContractStatus ? CONTRACT_STATUS_LABEL[status as ContractStatus] : status

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Contracts"
        subtitle="History is preserved; payroll uses the contract covering the payrun period."
      />

      <ListToolbar
        newHref={isHr ? "/contracts/new" : undefined}
        newLabel="New contract"
        searchPlaceholder="Search contracts…"
        chips={
          <>
            {filterEmployee && (
              <FilterChip
                paramKey="employeeId"
                label={`Employee: ${filterEmployee.firstName} ${filterEmployee.lastName}`}
              />
            )}
            {status && <FilterChip paramKey="status" label={`Status: ${statusLabel}`} />}
          </>
        }
      >
        <RecordStats
          stats={[
            { label: "contracts", value: contracts.length, tone: "primary" },
            { label: "running", value: running, tone: "success" },
          ]}
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        rows={contracts}
        rowKey={(r) => r.id}
        rowHref={(r) => `/contracts/${r.id}`}
        empty={
          <EmptyState
            icon={FileText}
            title="No contracts yet"
            description="A contract carries the wage, schedule and salary structure payroll computes from."
          />
        }
        footer={<RowCount shown={contracts.length} total={contracts.length} />}
      />
    </>
  )
}
