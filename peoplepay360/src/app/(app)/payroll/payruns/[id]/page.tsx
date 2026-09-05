import { PayslipStatus, Role } from "@prisma/client"
import { AlertTriangle } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PayrunActionBar } from "@/components/payroll/PayrunActionBar"
import { WarningsPanel } from "@/components/payroll/WarningsPanel"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtRange } from "@/lib/dates"
import { formatINR, formatMoneyCompact } from "@/lib/money"

type Row = {
  id: string
  reference: string
  status: PayslipStatus
  basic: unknown
  gross: unknown
  net: unknown
  contractId: string | null
  employee: { firstName: string; lastName: string; bankAccountNumber: string | null }
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
    render: (r) => {
      const issues: string[] = []
      if (!r.contractId) issues.push("no applicable contract")
      if (!r.employee.bankAccountNumber) issues.push("missing bank details")
      return issues.length > 0 ? (
        <span className="inline-flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="h-3.5 w-3.5" />
          {issues.join(", ")}
        </span>
      ) : (
        <span className="text-muted-foreground">—</span>
      )
    },
  },
  { key: "basic", header: "Basic", numeric: true, render: (r) => formatMoneyCompact(String(r.basic)) },
  { key: "gross", header: "Gross", numeric: true, render: (r) => formatMoneyCompact(String(r.gross)) },
  {
    key: "net",
    header: "Net",
    numeric: true,
    render: (r) => <span className="font-semibold">{formatMoneyCompact(String(r.net))}</span>,
  },
  { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
]

export default async function PayrunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Payruns are restricted to payroll roles." />

  const { id } = await params
  const payrun = await db.payrun.findUnique({
    where: { id },
    include: {
      structure: { select: { id: true, name: true } },
      warnings: {
        select: {
          id: true,
          code: true,
          severity: true,
          message: true,
          payslipId: true,
        },
      },
      payslips: {
        select: {
          id: true,
          reference: true,
          status: true,
          basic: true,
          gross: true,
          net: true,
          sentAt: true,
          contractId: true,
          employee: {
            select: { firstName: true, lastName: true, bankAccountNumber: true },
          },
        },
        orderBy: { employee: { firstName: "asc" } },
      },
    },
  })
  if (!payrun) notFound()

  const totalNet = payrun.payslips.reduce((sum, p) => sum + Number(p.net), 0)
  const blockingCount = payrun.warnings.filter((w) => w.severity === "BLOCKING").length
  const issues = payrun.warnings.length

  return (
    <>
      <FormHeader
        breadcrumb="Payruns"
        backHref="/payroll/payruns"
        title={payrun.name}
        subtitle={`${fmtRange(payrun.periodStart, payrun.periodEnd)} · ${payrun.structure.name} · ${payrun.payslips.length} payslips · ${formatINR(totalNet)} total net`}
        badge={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={payrun.status} />
            {issues > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning">
                <AlertTriangle className="h-3 w-3" />
                {issues} warning{issues === 1 ? "" : "s"}
              </span>
            )}
          </span>
        }
        actions={
          <PayrunActionBar
            payrunId={payrun.id}
            status={payrun.status}
            blockingCount={blockingCount}
          />
        }
      />

      <WarningsPanel warnings={payrun.warnings} />

      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-lg border border-border bg-surface px-5 py-3 text-sm shadow-card">
        <span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Structure</span>{" "}
          <Link
            href={`/payroll/structures/${payrun.structure.id}`}
            className="ml-1.5 font-medium text-primary hover:underline"
          >
            {payrun.structure.name}
          </Link>
        </span>
        <span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Period</span>{" "}
          <span className="ml-1.5 font-medium">
            {fmtRange(payrun.periodStart, payrun.periodEnd)}
          </span>
        </span>
        <span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground">Total Net</span>{" "}
          <span className="ml-1.5 font-semibold tabular">{formatINR(totalNet)}</span>
        </span>
      </div>

      <DataTable
        columns={columns}
        rows={payrun.payslips}
        rowKey={(r) => r.id}
        rowHref={(r) => `/payroll/payslips/${r.id}`}
        empty={
          <EmptyState
            title="No payslips in this payrun"
            description="Payslips are created when the payrun is created, from the employees you selected."
          />
        }
        footer={<RowCount shown={payrun.payslips.length} total={payrun.payslips.length} />}
      />
    </>
  )
}
