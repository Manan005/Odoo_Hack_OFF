import { PayrunStatus, Role } from "@prisma/client"
import { Banknote } from "lucide-react"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PayrunWizard } from "@/components/payroll/PayrunWizard"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtRange } from "@/lib/dates"
import { formatMoneyCompact } from "@/lib/money"

export const metadata = { title: "Payruns — PeoplePay360" }

type Row = {
  id: string
  name: string
  periodStart: Date
  periodEnd: Date
  status: PayrunStatus
  structure: { name: string }
  _count: { payslips: number }
  payslips: Array<{ net: unknown }>
}

const columns: Column<Row>[] = [
  { key: "name", header: "Name", render: (r) => r.name },
  {
    key: "period",
    header: "Period",
    render: (r) => fmtRange(r.periodStart, r.periodEnd),
  },
  { key: "structure", header: "Structure", render: (r) => r.structure.name },
  {
    key: "employees",
    header: "Employees",
    numeric: true,
    render: (r) => `${r._count.payslips} employees`,
  },
  {
    key: "net",
    header: "Total Net",
    numeric: true,
    render: (r) =>
      formatMoneyCompact(r.payslips.reduce((sum, p) => sum + Number(p.net), 0)),
  },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
]

export default async function PayrunsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; year?: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Payruns are restricted to payroll roles." />

  const { q, year } = await searchParams

  const yearFilter = year
    ? {
        periodStart: {
          gte: new Date(Date.UTC(Number(year), 0, 1)),
          lte: new Date(Date.UTC(Number(year), 11, 31)),
        },
      }
    : {}

  const [payruns, structures, departments] = await Promise.all([
    db.payrun.findMany({
      where: {
        companyId: user.companyId,
        ...yearFilter,
        ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
      },
      select: {
        id: true,
        name: true,
        periodStart: true,
        periodEnd: true,
        status: true,
        structure: { select: { name: true } },
        _count: { select: { payslips: true } },
        payslips: { select: { net: true } },
      },
      orderBy: { periodStart: "desc" },
    }),
    db.salaryStructure.findMany({
      where: { companyId: user.companyId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.department.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ])

  return (
    <>
      <PageHeader
        title="Payruns"
        subtitle="Draft → Compute → Validate → Mark Paid. Paid runs are kept as history."
        actions={<PayrunWizard structures={structures} departments={departments} />}
      />

      <div className="flex h-12 items-center gap-3 rounded-t-lg border border-b-0 border-border bg-surface-muted px-4">
        <span className="text-xs text-muted-foreground">
          Clicking NEW opens a wizard — the payrun is created only after you select employees.
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={payruns}
        rowKey={(r) => r.id}
        rowHref={(r) => `/payroll/payruns/${r.id}`}
        empty={
          <EmptyState
            icon={Banknote}
            title="No payruns yet"
            description="A payrun groups the payslips for one period and one salary structure."
          />
        }
        footer={<RowCount shown={payruns.length} total={payruns.length} />}
      />
    </>
  )
}
