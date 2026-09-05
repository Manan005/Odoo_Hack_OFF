import { Role } from "@prisma/client"
import { ComingInPhase } from "@/components/shared/ComingInPhase"
import { Forbidden } from "@/components/shared/Forbidden"
import { pageAllows } from "@/lib/auth-guard"

export const metadata = { title: "Payroll Dashboard — PeoplePay360" }

// P8 replaces this stub with the real aggregation dashboard.
export default async function PayrollDashboardPage() {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="The payroll dashboard is restricted to payroll roles." />

  return (
    <ComingInPhase
      title="Payroll Dashboard"
      phase="P8"
      hours="20–23"
      description="Live KPIs, salary-cost and trend charts, and attendance/time-off overviews aggregated across every module — filterable by period, department and employee type."
      buildsOn={[
        "P3 Contracts — wage and period-applicable contract resolution",
        "P4 Attendance — presence, overtime and coverage metrics",
        "P5 Time Off — approved days and remaining balances",
        "P6 Payroll — payslip totals that drive the salary KPIs and trend",
      ]}
    />
  )
}
