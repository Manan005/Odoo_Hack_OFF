import { EmployeeType, Role } from "@prisma/client"
import { ChartCard } from "@/components/dashboard/ChartCard"
import {
  MonthlyTrendChart,
  PayslipStatusChart,
  SalaryByDepartmentChart,
} from "@/components/dashboard/DashboardCharts"
import { DashboardFilterBar } from "@/components/dashboard/DashboardFilters"
import { KpiCard } from "@/components/dashboard/KpiCard"
import {
  AlertsPanel,
  AttendancePanel,
  DepartmentPanel,
  TimeOffPanel,
} from "@/components/dashboard/OverviewPanels"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import {
  getAttendanceOverview,
  getDepartmentOverview,
  getKpis,
  getMonthlyTrend,
  getPayslipStatusSplit,
  getSalaryByDepartment,
  getTimeOffOverview,
  type DashboardFilters,
} from "@/lib/dashboard/aggregate"
import { db } from "@/lib/db"
import { formatINR, formatLakh } from "@/lib/money"

export const metadata = { title: "Payroll Dashboard — PeoplePay360" }

/** Twelve months back from the seeded demo window, newest first. */
function periodOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = []
  const anchor = new Date(Date.UTC(2026, 8, 1))
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() - i, 1))
    options.push({
      value: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`,
      label: d.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    })
  }
  return options
}

function periodRange(value: string): { periodStart: Date; periodEnd: Date } {
  const [year, month] = value.split("-").map(Number)
  return {
    periodStart: new Date(Date.UTC(year, month - 1, 1)),
    periodEnd: new Date(Date.UTC(year, month, 0, 23, 59, 59)),
  }
}

export default async function PayrollDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string; departmentId?: string; employeeType?: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="The payroll dashboard is restricted to payroll roles." />

  const params = await searchParams
  const periods = periodOptions()
  const period = params.period && /^\d{4}-\d{2}$/.test(params.period)
    ? params.period
    : periods[0].value

  const filters: DashboardFilters = {
    companyId: user.companyId,
    ...periodRange(period),
    departmentId: params.departmentId || undefined,
    employeeType:
      params.employeeType && params.employeeType in EmployeeType
        ? (params.employeeType as EmployeeType)
        : undefined,
  }

  // Seven aggregates in parallel — every figure below is a live query.
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
  ])

  return (
    <>
      <PageHeader
        title="Payroll Dashboard"
        subtitle="Every figure is aggregated live across employees, contracts, attendance, time off and payroll."
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

      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Total Net Salary Paid"
          value={formatLakh(kpis.totalNet)}
          delta={kpis.netDeltaPct}
          source="Payslips"
        />
        <KpiCard
          label="Payslips Generated"
          value={String(kpis.payslipsGenerated)}
          caption={`${kpis.payslipsPaid} paid, ${kpis.payslipsPending} pending`}
          source="Payslip status"
        />
        <KpiCard
          label="Avg Salary / Employee"
          value={formatINR(kpis.avgSalary, 0)}
          caption="Across payslips in this period"
          source="Payslips ÷ headcount"
        />
        <KpiCard
          label="Approved Time Off"
          value={`${kpis.approvedTimeOffDays} Days`}
          caption="Across the selected period"
          source="Time Off Requests"
        />
        <KpiCard
          label="Attendance Health"
          value={`${kpis.attendanceHealthPct.toFixed(0)}%`}
          caption={`${kpis.presentish} of ${kpis.expectedRecords} records`}
          source="Attendance"
        />
      </div>

      <div className="mb-5 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <ChartCard
          title="Salary Cost by Department"
          source="Payslips + Employee Department"
        >
          <SalaryByDepartmentChart data={salaryByDept} />
        </ChartCard>

        <ChartCard title="Monthly Net Salary Trend" source="Historical Payslips / Payruns">
          <MonthlyTrendChart data={trend} />
        </ChartCard>

        <ChartCard title="Payslip Status" source="Payrun + Payslip validation">
          <PayslipStatusChart data={statusSplit.split} />
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <AttendancePanel data={attendance} />
        <TimeOffPanel rows={timeOff} />
        <DepartmentPanel rows={deptOverview} />
        <AlertsPanel alerts={statusSplit.alerts} />
      </div>

      <p className="mt-5 rounded-lg border border-border bg-surface-muted px-4 py-3 text-xs text-muted-foreground">
        <span className="font-medium">Models aggregated:</span> Employees and Departments for
        headcount and grouping · Contracts for wage and schedule · Payruns and Payslips for
        salary totals, paid versus pending, and trend · Attendance for presence, absences and
        overtime · Time Off Requests and Allocations for leave taken and remaining balance.
      </p>
    </>
  )
}
