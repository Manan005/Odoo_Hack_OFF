import { PayslipStatus, Role } from "@prisma/client"
import { AlertTriangle, MailCheck } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Spotlight } from "@/components/motion/Spotlight"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PayrunActionBar } from "@/components/payroll/PayrunActionBar"
import { PayrunStepper } from "@/components/payroll/PayrunStepper"
import { WarningsPanel } from "@/components/payroll/WarningsPanel"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Surface } from "@/components/ui/surface"
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
  sentAt: Date | null
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
    key: "reference",
    header: "Reference",
    render: (r) => <span className="font-mono text-[12.5px] text-muted-foreground">{r.reference}</span>,
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
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <StatusBadge status={r.status} />
        {r.sentAt && (
          <span
            className="inline-flex items-center text-success"
            title={`Emailed ${r.sentAt.toLocaleDateString()}`}
          >
            <MailCheck className="h-3.5 w-3.5" aria-hidden />
            <span className="sr-only">Emailed</span>
          </span>
        )}
      </span>
    ),
  },
]

const eyebrow = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

export default async function PayrunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Payruns are restricted to payroll roles." />

  const { id } = await params
  const [payrun, sums] = await Promise.all([
    db.payrun.findUnique({
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
    }),
    // Run totals are a database aggregate of the stored roll-ups — no money
    // arithmetic happens in the page (rules.md §3).
    db.payslip.aggregate({
      where: { payrunId: id },
      _sum: { gross: true, net: true },
      _count: { _all: true },
    }),
  ])
  if (!payrun) notFound()

  const blockingCount = payrun.warnings.filter((w) => w.severity === "BLOCKING").length
  const issues = payrun.warnings.length
  const allSent = payrun.payslips.length > 0 && payrun.payslips.every((p) => p.sentAt !== null)
  const employees = sums._count._all

  return (
    <>
      <FormHeader
        breadcrumb="Payruns"
        backHref="/payroll/payruns"
        title={payrun.name}
        subtitle={`${fmtRange(payrun.periodStart, payrun.periodEnd)} · ${payrun.structure.name} · ${employees} payslip${employees === 1 ? "" : "s"}`}
        badge={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={payrun.status} />
            {issues > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md bg-warning-subtle px-2 py-0.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/25">
                <AlertTriangle className="h-3 w-3" aria-hidden />
                {issues} warning{issues === 1 ? "" : "s"}
              </span>
            )}
          </span>
        }
      />

      <PayrunActionBar
        payrunId={payrun.id}
        status={payrun.status}
        blockingCount={blockingCount}
        payslipCount={employees}
        allSent={allSent}
      />

      <Surface className="mb-5 grid gap-6 px-6 py-5 lg:grid-cols-[1.35fr_1fr] lg:items-center">
        <PayrunStepper status={payrun.status} allSent={allSent} className="pt-1" />
        <dl className="stagger grid grid-cols-2 gap-4 border-t border-border/70 pt-4 text-sm lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
          <div>
            <dt className={eyebrow}>Structure</dt>
            <dd className="mt-1">
              <Link
                href={`/payroll/structures/${payrun.structure.id}`}
                className="font-medium text-primary hover:underline"
              >
                {payrun.structure.name}
              </Link>
            </dd>
          </div>
          <div>
            <dt className={eyebrow}>Period</dt>
            <dd className="mt-1 font-medium">{fmtRange(payrun.periodStart, payrun.periodEnd)}</dd>
          </div>
        </dl>
      </Surface>

      <div className="stagger mb-5 grid gap-3 sm:grid-cols-3">
        <Spotlight className="pay-tile p-4">
          <p className={eyebrow}>Employees</p>
          <p className="mt-1.5 text-2xl font-semibold tabular">
            <NumberTicker value={String(employees)} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">one payslip each, from the period-applicable contract</p>
        </Spotlight>
        <Spotlight className="pay-tile p-4">
          <p className={eyebrow}>Total gross</p>
          <p className="mt-1.5 text-2xl font-semibold tabular">
            <NumberTicker value={formatINR(sums._sum.gross)} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">sum of every payslip&apos;s gross line</p>
        </Spotlight>
        <Spotlight className="pay-tile pay-tile-hero p-4">
          <p className={eyebrow}>Total net</p>
          <p className="mt-1.5 text-2xl font-semibold tabular text-primary">
            <NumberTicker value={formatINR(sums._sum.net)} delayStep={50} />
          </p>
          <p className="mt-1 text-xs text-muted-foreground">what leaves the bank when this run is paid</p>
        </Spotlight>
      </div>

      <WarningsPanel warnings={payrun.warnings} />

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
