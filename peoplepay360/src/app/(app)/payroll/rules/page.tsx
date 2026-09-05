import { Role } from "@prisma/client"
import { ComingInPhase } from "@/components/shared/ComingInPhase"
import { Forbidden } from "@/components/shared/Forbidden"
import { pageAllows } from "@/lib/auth-guard"

export const metadata = { title: "Salary Rules — PeoplePay360" }

// P6 replaces this stub.
export default async function SalaryRulesPage() {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Salary rules are restricted to payroll roles." />

  return (
    <ComingInPhase
      title="Salary Rules"
      phase="P6"
      hours="13–17"
      description="Fixed amounts, percentages of a base, or formulas — executed in sequence so later rules such as Gross and Net can build on earlier results."
    />
  )
}
