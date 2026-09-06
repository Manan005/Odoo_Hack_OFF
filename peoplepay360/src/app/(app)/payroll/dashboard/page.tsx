import { EmployeeType, Role } from "@prisma/client"
import { AttendanceGauge } from "@/components/dashboard/AttendanceGauge"
import { ChartCard } from "@/components/dashboard/ChartCard"
import { MonthlyTrendChart, SalaryByDepartmentChart } from "@/components/dashboard/DashboardCharts"
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilters"
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
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import {
  getAttendanceOverview,
  getDepartmentOverview,
  getKpis,
  getLatestPayslipPeriod,
  getModelCounts,
  getMonthlyTrend,
  getNetComposition,
  getPayslipStatusSplit,
  getPeriodPayrun,
  getSalaryByDepartment,
  getTimeOffOverview,
  getWarningSeverityCounts,
  type DashboardFilters,
} from "@/lib/dashboard/aggregate"
import { db } from "@/lib/db"
import { formatDuration, formatINR } from "@/lib/money"

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

  const params = await searchParams

  // First paint is never a month of zeros: default to the newest month that
  // actually has payslips, keeping ?period= as the override.
  const latest = await getLatestPayslipPeriod(user.companyId)
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

  // Thirteen aggregates in parallel — every figure below is a live query.
  const [
    company,
    departments,
    kpis,
    salaryByDept,
    trend,
    statusSplit,
    attendance,
    timeOff,
    deptOverview,
    payrun,
    composition,
    counts,
    warningCounts,
  ] = await Promise.all([
    db.company.findUnique({ where: { id: user.companyId }, select: { name: true } }),
    db.department.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getKpis(filters),
    getSalaryByDepartment(filters),
    getMonthlyTrend(filters),
    getPayslipStatusSplit(filters),
    getAttendanceOverview(filters),
    getTimeOffOverview(filters),
    getDepartmentOverview(filters),
    getPeriodPayrun(filters),
    getNetComposition(filters),
    getModelCounts(filters),
    getWarningSeverityCounts(filters),
  ])

  const payslipsHref = payrun ? `/payroll/payslips?payrunId=${payrun.id}` : "/payroll/payslips"
  const payrunHref = payrun ? `/payroll/payruns/${payrun.id}` : null

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
       * Bento — one 12-column grid at xl (the 1280px floor), 2 columns at sm.
       *   Row A   hero net 5 (rows 1–2) · payslips 4 · attendance gauge 3 (rows 1–2)
       *   Row B   avg net 2 · approved time off 2   (fills the 4 under payslips)
       *   Row C   net composition 12
       *   Row D   monthly trend 8 · salary by department 4
       *   Row E   attendance overview 7 · payroll alerts 5
       *   Row F   department overview 7 · time off overview 5
       * One .stagger parent so the cascade reads left-to-right, top-to-bottom;
       * rows D–F carry .reveal and animate on scroll where view() is supported.
       */}
      <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-12">
        <HeroNetCard
          className="sm:col-span-2 xl:col-span-5 xl:row-span-2"
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
          className="xl:col-span-4"
          label="Payslips"
          value={String(kpis.payslipsGenerated)}
          href={payslipsHref}
          hrefLabel="open the payslip list"
          source="Payslip status"
        >
          <PayslipStatusBar split={statusSplit.split} />
        </KpiCard>

        <KpiCard
          className="xl:col-span-3 xl:row-span-2"
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
          className="xl:col-span-2"
          label="Avg net / payslip"
          value={formatINR(kpis.avgSalary, 0)}
          caption="Net ÷ payslips in the period"
          source="Payslips"
        />

        <KpiCard
          className="xl:col-span-2"
          label="Approved time off"
          value={formatDuration(kpis.approvedTimeOffDays)}
          href="/time-off/requests?status=APPROVED"
          hrefLabel="open approved requests"
          caption="Requests overlapping the period"
          source="Time Off Requests"
        />

        <NetCompositionBand
          className="sm:col-span-2 xl:col-span-12"
          data={composition}
          periodLabel={periodLabel}
        />

        <ChartCard
          className="reveal sm:col-span-2 xl:col-span-8"
          bodyClassName="h-72"
          title="Monthly Net Salary Trend"
          source="Payslips bucketed by period"
        >
          <MonthlyTrendChart data={trend} />
        </ChartCard>

        <ChartCard
          className="reveal xl:col-span-4"
          bodyClassName="h-72"
          title="Salary Cost by Department"
          source="Payslips + Employee Department"
        >
          <SalaryByDepartmentChart data={salaryByDept} />
        </ChartCard>

        <AttendancePanel className="reveal xl:col-span-7" data={attendance} />
        <AlertsPanel
          className="reveal xl:col-span-5"
          alerts={statusSplit.alerts}
          counts={warningCounts}
          payrunHref={payrunHref}
        />
        <DepartmentPanel className="reveal xl:col-span-7" rows={deptOverview} />
        <TimeOffPanel className="reveal xl:col-span-5" rows={timeOff} />
      </div>

      <ProofStrip counts={counts} periodLabel={periodLabel} payslipsHref={payslipsHref} />
    </>
  )
}
