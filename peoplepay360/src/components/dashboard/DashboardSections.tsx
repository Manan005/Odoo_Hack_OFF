import { AttendanceGauge } from "@/components/dashboard/AttendanceGauge"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { MonthlyTrendChart, SalaryByDepartmentChart } from "@/components/dashboard/DashboardCharts"
import { HeroNetCard } from "@/components/dashboard/HeroNetCard"
import { KpiCard } from "@/components/dashboard/KpiCard"
import { NetCompositionBand } from "@/components/dashboard/NetCompositionBand"
import {
  AlertsPanel,
  AttendancePanel,
  DepartmentPanel,
  TimeOffPanel,
} from "@/components/dashboard/OverviewPanels"
import { PayslipStatusBar } from "@/components/dashboard/PayslipStatusBar"
import { ProofStrip } from "@/components/dashboard/ProofStrip"
import { Skeleton } from "@/components/ui/skeleton"
import { Surface } from "@/components/ui/surface"
import {
  getAttendanceOverview,
  getDepartmentOverview,
  getKpis,
  getModelCounts,
  getMonthlyTrend,
  getNetComposition,
  getPayslipStatusSplit,
  getPeriodPayrun,
  getSalaryByDepartment,
  getTimeOffOverview,
  getWarningSeverityCounts,
  type DashboardFilters,
  type PeriodPayrun,
} from "@/lib/dashboard/aggregate"
import { formatDuration, formatINR } from "@/lib/money"
import { cn } from "@/lib/utils"

/*
 * The payroll dashboard, split into sections that stream independently.
 * The page renders the header and filter rail at once and wraps each section
 * in <Suspense>; a section's fallback fills exactly the grid cells its
 * content will, with the same spans and minimum heights measured from the
 * rendered cards at phone, sm and lg widths, so the page barely moves when
 * data lands. Heights of the list panels still follow their row counts.
 *
 * Sections ask for data by filters. The aggregates are memoised per request
 * (lib/dashboard/aggregate.ts), so figures two sections share, such as the
 * trend or the period's payrun, are queried once.
 */

export interface SectionProps {
  filters: DashboardFilters
  periodLabel: string
  prevLabel: string
}

const payslipsHrefOf = (payrun: PeriodPayrun | null) =>
  payrun ? `/payroll/payslips?payrunId=${payrun.id}` : "/payroll/payslips"

/** Grid spans shared by each section and its skeleton. */
const SPAN = {
  hero: "sm:col-span-2 lg:col-span-5 lg:row-span-2",
  payslips: "lg:col-span-4",
  gauge: "lg:col-span-3 lg:row-span-2",
  small: "lg:col-span-2",
  band: "sm:col-span-2 lg:col-span-12",
  trend: "sm:col-span-2 lg:col-span-8",
  salary: "sm:col-span-2 lg:col-span-4",
  wide: "lg:col-span-7",
  narrow: "lg:col-span-5",
} as const

// ─────────────────────────── Rows A–C: headline figures ───────────────────────────

export async function HeadlineSection({ filters, periodLabel, prevLabel }: SectionProps) {
  const [kpis, statusSplit, attendance, trend, payrun, composition] = await Promise.all([
    getKpis(filters),
    getPayslipStatusSplit(filters),
    getAttendanceOverview(filters),
    getMonthlyTrend(filters),
    getPeriodPayrun(filters),
    getNetComposition(filters),
  ])
  const payslipsHref = payslipsHrefOf(payrun)

  return (
    <>
      <HeroNetCard
        className={SPAN.hero}
        periodLabel={periodLabel}
        prevLabel={prevLabel}
        totalNet={kpis.totalNet}
        prevNet={kpis.prevNet}
        deltaPct={kpis.netDeltaPct}
        payslips={kpis.payslipsGenerated}
        trend={trend}
        payrun={payrun}
        payslipsHref={payslipsHref}
      />

      <KpiCard
        className={SPAN.payslips}
        label="Payslips"
        value={String(kpis.payslipsGenerated)}
        href={payslipsHref}
        hrefLabel="open the payslip list"
        source="Payslip status"
      >
        <PayslipStatusBar split={statusSplit.split} />
      </KpiCard>

      <KpiCard
        className={SPAN.gauge}
        label="Attendance health"
        href="/attendance"
        hrefLabel="open attendance"
        caption={`${kpis.presentish} of ${kpis.expectedRecords} records are not absences`}
        source="Attendance · coverage from working schedules"
      >
        <AttendanceGauge
          pct={kpis.attendanceHealthPct}
          coveragePct={attendance.coveragePct}
          className="mt-3"
        />
        <p className="mt-1 flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground tabular">
          <span className="h-1.5 w-1.5 rounded-full bg-chart-2" aria-hidden />
          coverage {attendance.coveragePct.toFixed(1)}%
        </p>
      </KpiCard>

      <KpiCard
        className={SPAN.small}
        label="Avg net / payslip"
        value={formatINR(kpis.avgSalary, 0)}
        caption="Net ÷ payslips in the period"
        source="Payslips"
      />

      <KpiCard
        className={SPAN.small}
        label="Approved time off"
        value={formatDuration(kpis.approvedTimeOffDays)}
        href="/time-off/requests?status=APPROVED"
        hrefLabel="open approved requests"
        caption="Requests overlapping the period"
        source="Time Off Requests"
      />

      <NetCompositionBand className={SPAN.band} data={composition} periodLabel={periodLabel} />
    </>
  )
}

export function HeadlineSkeleton() {
  return (
    <>
      <Surface aria-busy="true" className={cn(SPAN.hero, "flex min-h-[364px] flex-col justify-between gap-6 p-5 sm:min-h-[376px]")}>
        <div className="space-y-3">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-3/5 max-w-60" />
          <Skeleton className="h-3 w-2/5 max-w-40" />
        </div>
        <Skeleton className="h-20 w-full rounded-xl" />
      </Surface>
      <CardSkeleton className={cn(SPAN.payslips, "min-h-[183px] lg:min-h-[189px]")} bar />
      <Surface aria-busy="true" className={cn(SPAN.gauge, "flex min-h-[327px] flex-col items-center gap-4 p-5")}>
        <Skeleton className="h-3 w-28 self-start" />
        <Skeleton className="mt-2 size-32 rounded-full" />
        <Skeleton className="h-3 w-3/4" />
      </Surface>
      <CardSkeleton className={cn(SPAN.small, "min-h-[164px] lg:min-h-[171px]")} />
      <CardSkeleton className={cn(SPAN.small, "min-h-[164px] lg:min-h-[171px]")} />
      <Surface aria-busy="true" className={cn(SPAN.band, "min-h-[335px] space-y-4 p-5 sm:min-h-[233px]")}>
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-3 w-full rounded-full" />
        <div className="flex flex-wrap gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-3 w-24" />
          ))}
        </div>
      </Surface>
    </>
  )
}

// ─────────────────────────── Row D: charts ───────────────────────────

export async function ChartsSection({ filters }: SectionProps) {
  const [trend, salaryByDept] = await Promise.all([
    getMonthlyTrend(filters),
    getSalaryByDepartment(filters),
  ])

  return (
    <>
      <ChartCard
        className={cn("reveal", SPAN.trend)}
        bodyClassName="h-64 sm:h-72"
        title="Monthly Net Salary Trend"
        source="Payslips bucketed by period"
      >
        <MonthlyTrendChart data={trend} />
      </ChartCard>

      <ChartCard
        className={cn("reveal", SPAN.salary)}
        bodyClassName="h-64 sm:h-72"
        title="Salary Cost by Department"
        source="Payslips + Employee Department"
      >
        <SalaryByDepartmentChart data={salaryByDept} />
      </ChartCard>
    </>
  )
}

export function ChartsSkeleton() {
  return (
    <>
      <ChartSkeleton className={SPAN.trend} />
      <ChartSkeleton className={SPAN.salary} />
    </>
  )
}

// ─────────────────────────── Rows E–F: overview panels ───────────────────────────

export async function PanelsSection({ filters }: SectionProps) {
  const [attendance, statusSplit, warningCounts, payrun, deptOverview, timeOff] = await Promise.all([
    getAttendanceOverview(filters),
    getPayslipStatusSplit(filters),
    getWarningSeverityCounts(filters),
    getPeriodPayrun(filters),
    getDepartmentOverview(filters),
    getTimeOffOverview(filters),
  ])

  return (
    <>
      <AttendancePanel className={cn("reveal", SPAN.wide)} data={attendance} />
      <AlertsPanel
        className={cn("reveal", SPAN.narrow)}
        alerts={statusSplit.alerts}
        counts={warningCounts}
        payrunHref={payrun ? `/payroll/payruns/${payrun.id}` : null}
      />
      <DepartmentPanel className={cn("reveal", SPAN.wide)} rows={deptOverview} />
      <TimeOffPanel className={cn("reveal", SPAN.narrow)} rows={timeOff} />
    </>
  )
}

export function PanelsSkeleton() {
  return (
    <>
      <PanelSkeleton className={cn(SPAN.wide, "min-h-[398px] sm:min-h-[302px]")} rows={6} />
      <PanelSkeleton className={cn(SPAN.narrow, "min-h-[264px] sm:min-h-[302px]")} rows={4} />
      <PanelSkeleton className={cn(SPAN.wide, "min-h-[271px]")} rows={5} />
      <PanelSkeleton className={cn(SPAN.narrow, "min-h-[291px] sm:min-h-[271px]")} rows={4} />
    </>
  )
}

// ─────────────────────────── Proof strip ───────────────────────────

export async function ProofSection({ filters, periodLabel }: SectionProps) {
  const [counts, payrun] = await Promise.all([getModelCounts(filters), getPeriodPayrun(filters)])
  return <ProofStrip counts={counts} periodLabel={periodLabel} payslipsHref={payslipsHrefOf(payrun)} />
}

export function ProofSkeleton() {
  return (
    <section aria-busy="true" className="mt-6 min-h-[347px] sm:min-h-[223px] lg:min-h-[119px]">
      <Skeleton className="mb-2.5 h-3 w-32" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Surface key={i} className="h-[92px] space-y-3 p-4">
            <Skeleton className="h-3 w-3/4" />
            <Skeleton className="h-6 w-1/3" />
          </Surface>
        ))}
      </div>
    </section>
  )
}

// ─────────────────────────── Skeleton pieces ───────────────────────────

function CardSkeleton({ className, bar }: { className?: string; bar?: boolean }) {
  return (
    <Surface aria-busy="true" className={cn("flex flex-col gap-3 p-5", className)}>
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-2/3 max-w-32" />
      {bar && <Skeleton className="h-2 w-full rounded-full" />}
      <Skeleton className="mt-auto h-3 w-1/2" />
    </Surface>
  )
}

function ChartSkeleton({ className }: { className?: string }) {
  return (
    // On a phone the real header wraps to two lines; from sm it fits on one.
    <Surface aria-busy="true" padded className={cn("min-h-[361px] min-w-0 sm:min-h-0", className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-44" />
        <Skeleton className="h-3 w-28" />
      </div>
      <Skeleton className="h-64 w-full rounded-xl sm:h-72" />
    </Surface>
  )
}

function PanelSkeleton({ className, rows }: { className?: string; rows: number }) {
  return (
    <Surface aria-busy="true" padded className={cn("min-w-0", className)}>
      <div className="mb-4 flex items-center justify-between gap-4">
        <Skeleton className="h-4 w-40" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    </Surface>
  )
}
