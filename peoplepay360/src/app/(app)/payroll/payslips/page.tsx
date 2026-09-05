import { PayslipStatus } from "@prisma/client"
import { AlertTriangle, Receipt } from "lucide-react"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtRange } from "@/lib/dates"
import { formatMoneyCompact } from "@/lib/money"

export const metadata = { title: "Payslips — PeoplePay360" }

type Row = {
  id: string
  periodStart: Date
  periodEnd: Date
  basic: unknown
  gross: unknown
  net: unknown
  status: PayslipStatus
  contractId: string | null
  employee: { firstName: string; lastName: string; bankAccountNumber: string | null }
  payrun: { name: string; structure: { name: string } }
}

const columns: Column<Row>[] = [
  {
    key: "employee",
    header: "Employee",
    render: (r) => `${r.employee.firstName} ${r.employee.lastName}`,
  },
  {
    key: "warning",
    header: "Warning",
    render: (r) =>
      !r.contractId || !r.employee.bankAccountNumber ? (
        <AlertTriangle className="h-4 w-4 text-warning" aria-label="Has warnings" />
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  { key: "period", header: "Period", render: (r) => fmtRange(r.periodStart, r.periodEnd) },
  { key: "basic", header: "Basic", numeric: true, render: (r) => formatMoneyCompact(String(r.basic)) },
  { key: "gross", header: "Gross", numeric: true, render: (r) => formatMoneyCompact(String(r.gross)) },
  {
    key: "net",
    header: "Net",
    numeric: true,
    render: (r) => <span className="font-semibold">{formatMoneyCompact(String(r.net))}</span>,
  },
  { key: "structure", header: "Structure", render: (r) => r.payrun.structure.name },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
]

export default async function PayslipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; payrunId?: string; employeeId?: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isPayroll = rankOf(viewer.roles) >= ROLE_RANK.HR_PAYROLL_USER
  const { q, payrunId, employeeId } = await searchParams

  // An employee may see their own payslips; anything wider needs payroll rank.
  const scopedEmployeeId = isPayroll ? employeeId : (viewer.employeeId ?? "__none__")

  const [payslips, filterPayrun] = await Promise.all([
    db.payslip.findMany({
      where: {
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        ...(payrunId ? { payrunId } : {}),
        ...(q
          ? {
              OR: [
                { employee: { firstName: { contains: q, mode: "insensitive" as const } } },
                { employee: { lastName: { contains: q, mode: "insensitive" as const } } },
                { reference: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        periodStart: true,
        periodEnd: true,
        basic: true,
        gross: true,
        net: true,
        status: true,
        contractId: true,
        employee: { select: { firstName: true, lastName: true, bankAccountNumber: true } },
        payrun: { select: { name: true, structure: { select: { name: true } } } },
      },
      orderBy: [{ periodStart: "desc" }, { employee: { firstName: "asc" } }],
      take: 200,
    }),
    payrunId
      ? db.payrun.findUnique({ where: { id: payrunId }, select: { name: true } })
      : null,
  ])

  return (
    <>
      <PageHeader
        title={isPayroll ? "Payslips" : "My Payslips"}
        subtitle="Every amount traces to a salary rule in the payrun's structure."
      />

      <ListToolbar
        searchPlaceholder="Search payslips…"
        chips={
          filterPayrun ? (
            <FilterChip paramKey="payrunId" label={`Payrun: ${filterPayrun.name}`} />
          ) : null
        }
      />

      <DataTable
        columns={columns}
        rows={payslips}
        rowKey={(r) => r.id}
        rowHref={(r) => `/payroll/payslips/${r.id}`}
        empty={
          <EmptyState
            icon={Receipt}
            title="No payslips yet"
            description="Payslips are produced by computing a payrun."
          />
        }
        footer={<RowCount shown={payslips.length} total={payslips.length} />}
      />
    </>
  )
}
