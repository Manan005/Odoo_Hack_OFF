import { EmployeeType, Role } from "@prisma/client"
import { Suspense } from "react"
import {
  ChartsSection,
  ChartsSkeleton,
  HeadlineSection,
  HeadlineSkeleton,
  PanelsSection,
  PanelsSkeleton,
  ProofSection,
  ProofSkeleton,
} from "@/components/dashboard/DashboardSections"
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilters"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import { getLatestPayslipPeriod, type DashboardFilters } from "@/lib/dashboard/aggregate"
import { db } from "@/lib/db"

export const metadata = { title: "Payroll Dashboard — PeoplePay360" }

// ───────────────────────────── Period helpers ─────────────────────────────

const monthKey = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`

const monthStart = (key: string) => {
  const [year, month] = key.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

const monthEnd = (start: Date) =>
  new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 0, 23, 59, 59))

const longMonth = (d: Date) =>
  d.toLocaleDateString("en-GB", { month: "long", year: "numeric", timeZone: "UTC" })

const shortMonth = (d: Date) => d.toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" })

/**
 * Twelve months, newest first, anchored on the later of the latest payroll
 * month and the current month so both are always selectable. The latest
 * payroll month is flagged in its label — it is the default selection.
 */
function periodOptions(top: Date, latest: string | null): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(top.getUTCFullYear(), top.getUTCMonth() - i, 1))
    const value = monthKey(d)
    options.push({
      value,
      label: value === latest ? `${longMonth(d)} · latest payroll` : longMonth(d),
    })
  }
  return options
}

export default async function PayrollDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; departmentId?: string; employeeType?: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="The payroll dashboard is restricted to payroll roles." />

  // The only data awaited before the first flush: what the header and the
  // filter rail need. One wave of three small queries.
  const [params, company, departments, latest] = await Promise.all([
    searchParams,
    db.company.findUnique({ where: { id: user.companyId }, select: { name: true } }),
    db.department.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // First paint is never a month of zeros: default to the newest month that
    // actually has payslips, keeping ?period= as the override.
    getLatestPayslipPeriod(user.companyId),
  ])

  const currentKey = monthKey(new Date())
  const top = latest && latest > currentKey ? monthStart(latest) : monthStart(currentKey)
  const periods = periodOptions(top, latest)
  const period =
    params.period && /^\d{4}-\d{2}$/.test(params.period) ? params.period : (latest ?? currentKey)

  const periodStart = monthStart(period)
  const periodEnd = monthEnd(periodStart)
  const prevStart = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() - 1, 1))
  const periodLabel = longMonth(periodStart)
  const prevLabel = shortMonth(prevStart)

  const filters: DashboardFilters = {
    companyId: user.companyId,
    periodStart,
    periodEnd,
    departmentId: params.departmentId || undefined,
    employeeType:
      params.employeeType && params.employeeType in EmployeeType
        ? (params.employeeType as EmployeeType)
        : undefined,
  }

  // Keyed on the scope so a filter change swaps every section back to its
  // skeleton at once, instead of holding stale figures with no feedback.
  const scopeKey = `${period}|${filters.departmentId ?? ""}|${filters.employeeType ?? ""}`
  const section = { filters, periodLabel, prevLabel }

  return (
    <>
      <PageHeader
        eyebrow="Payroll"
        title="Dashboard"
        subtitle={`Live aggregates across employees, contracts, attendance, time off and payroll for ${periodLabel}.`}
      />

      <DashboardFilterBar
        periods={periods}
        departments={departments}
        companyName={company?.name ?? "—"}
        current={{
          period,
          departmentId: params.departmentId ?? "",
          employeeType: params.employeeType ?? "",
        }}
      />

      {/*
       * Bento — one 12-column grid from lg (1024), 2 columns from sm (640),
       * a single column below that. Spans per breakpoint:
       *   lg+  Row A   hero net 5 (rows 1–2) · payslips 4 · attendance gauge 3 (rows 1–2)
       *        Row B   avg net 2 · approved time off 2   (fills the 4 under payslips)
       *        Row C   net composition 12
       *        Row D   monthly trend 8 · salary by department 4
       *        Row E   attendance overview 7 · payroll alerts 5
       *        Row F   department overview 7 · time off overview 5
       *   sm   hero, composition and both charts take the full 2 so their axes
       *        keep room; every other card is one column, so the KPI pairs and
       *        the panel pairs sit side by side.
       *   <sm  one column in source order.
       * One .stagger parent so the cascade reads left-to-right, top-to-bottom;
       * rows D–F carry .reveal and animate on scroll where view() is supported.
       */}
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12">
        <Suspense key={`headline-${scopeKey}`} fallback={<HeadlineSkeleton />}>
          <HeadlineSection {...section} />
        </Suspense>
        <Suspense key={`charts-${scopeKey}`} fallback={<ChartsSkeleton />}>
          <ChartsSection {...section} />
        </Suspense>
        <Suspense key={`panels-${scopeKey}`} fallback={<PanelsSkeleton />}>
          <PanelsSection {...section} />
        </Suspense>
      </div>

      <Suspense key={`proof-${scopeKey}`} fallback={<ProofSkeleton />}>
        <ProofSection {...section} />
      </Suspense>
    </>
  )
}
