import { AlertTriangle, Eye } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { PayslipComputation } from "@/components/payroll/PayslipComputation"
import { PayslipHero } from "@/components/payroll/PayslipHero"
import { PayslipPdfButton } from "@/components/payroll/PayslipPdfButton"
import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/surface"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtRange } from "@/lib/dates"
import { formatINR } from "@/lib/money"

export default async function PayslipDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const { id } = await params
  const payslip = await db.payslip.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          employeeCode: true,
          bankAccountNumber: true,
          department: { select: { name: true } },
          jobPosition: { select: { name: true } },
        },
      },
      payrun: {
        select: {
          id: true,
          name: true,
          status: true,
          structure: { select: { id: true, name: true } },
        },
      },
      contract: { select: { id: true, reference: true, wage: true } },
      lines: {
        orderBy: { sequence: "asc" },
        // The rule columns are what the "show its working" peek displays —
        // read, never evaluated, in the component.
        include: {
          rule: {
            select: {
              computationType: true,
              amount: true,
              percentage: true,
              percentageBase: true,
              baseRuleCode: true,
              formula: true,
              condition: true,
            },
          },
        },
      },
    },
  })
  if (!payslip) notFound()

  const isPayroll = rankOf(viewer.roles) >= ROLE_RANK.HR_PAYROLL_USER
  if (!isPayroll && payslip.employeeId !== viewer.employeeId) {
    return <Forbidden message="You can only view your own payslips." />
  }

  const employeeName = `${payslip.employee.firstName} ${payslip.employee.lastName}`

  const warnings: string[] = []
  if (!payslip.contractId) {
    warnings.push("No applicable contract for this period — the payslip cannot be computed.")
  }
  if (!payslip.employee.bankAccountNumber) {
    warnings.push("Missing bank details — this payslip cannot be paid out.")
  }

  const totals = {
    basic: payslip.basic,
    allowances: payslip.allowances,
    gross: payslip.gross,
    deductions: payslip.deductions,
    net: payslip.net,
  }

  return (
    <>
      <FormHeader
        breadcrumb={isPayroll ? "Payslips" : "My Payslips"}
        backHref="/payroll/payslips"
        title={`${employeeName} — ${payslip.payrun.name}`}
        subtitle={`${payslip.reference} · ${fmtRange(payslip.periodStart, payslip.periodEnd)}`}
        badge={
          <span className="inline-flex items-center gap-2">
            <StatusBadge status={payslip.status} />
            {payslip.sentAt && (
              <span className="text-xs text-muted-foreground">
                emailed {payslip.sentAt.toLocaleDateString()}
              </span>
            )}
          </span>
        }
        actions={
          <span className="flex items-center gap-2">
            {/* `?view=1` opens the browser's PDF viewer in a new tab. */}
            <a href={`/api/payslips/${payslip.id}/pdf?view=1`} target="_blank" rel="noopener noreferrer">
              <Button variant="ghost">
                <Eye className="h-4 w-4" aria-hidden />
                Preview
              </Button>
            </a>
            <PayslipPdfButton payslipId={payslip.id} fallbackName={`${payslip.reference}.pdf`} />
          </span>
        }
      />

      {warnings.length > 0 && (
        <div className="mb-5 space-y-1.5 rounded-xl bg-warning-subtle px-4 py-3 ring-1 ring-inset ring-warning/25">
          {warnings.map((w) => (
            <p key={w} className="flex items-start gap-2 text-xs text-warning">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="text-foreground/90">{w}</span>
            </p>
          ))}
        </div>
      )}

      <div className="mb-5 grid gap-5 lg:grid-cols-[1fr_minmax(20rem,24rem)] lg:items-start">
        <Surface as="section" padded>
          <dl className="stagger grid grid-cols-2 gap-x-8 gap-y-5 md:grid-cols-3">
            {[
              ["Employee", employeeName],
              ["Employee Code", payslip.employee.employeeCode],
              ["Department", payslip.employee.department?.name ?? "—"],
              ["Job Position", payslip.employee.jobPosition?.name ?? "—"],
              ["Period", fmtRange(payslip.periodStart, payslip.periodEnd)],
              ["Worked Days", String(payslip.workedDays)],
              [
                "Contract",
                payslip.contract ? (
                  <Link
                    href={`/contracts/${payslip.contract.id}`}
                    className="font-mono text-[13px] text-primary hover:underline"
                  >
                    {payslip.contract.reference}
                  </Link>
                ) : (
                  <span className="text-warning">none</span>
                ),
              ],
              [
                "Contract Wage",
                payslip.contract ? formatINR(String(payslip.contract.wage)) : "—",
              ],
              [
                "Salary Structure",
                <Link
                  key="s"
                  href={`/payroll/structures/${payslip.payrun.structure.id}`}
                  className="text-primary hover:underline"
                >
                  {payslip.payrun.structure.name}
                </Link>,
              ],
              [
                "Pay Run",
                <Link
                  key="p"
                  href={`/payroll/payruns/${payslip.payrun.id}`}
                  className="text-primary hover:underline"
                >
                  {payslip.payrun.name}
                </Link>,
              ],
            ].map(([label, value]) => (
              <div key={String(label)}>
                <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {label}
                </dt>
                <dd className="mt-1 text-sm font-medium tabular">{value}</dd>
              </div>
            ))}
          </dl>
        </Surface>

        <PayslipHero totals={totals} status={payslip.status} />
      </div>

      <PayslipComputation lines={payslip.lines} totals={totals} />
    </>
  )
}
