import { Role } from "@prisma/client"
import { ComingInPhase } from "@/components/shared/ComingInPhase"
import { Forbidden } from "@/components/shared/Forbidden"
import { pageAllows } from "@/lib/auth-guard"

export const metadata = { title: "Payruns — PeoplePay360" }

// P6 replaces this stub.
export default async function PayrunsPage() {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Payruns are restricted to payroll roles." />

  return (
    <ComingInPhase
      title="Payruns"
      phase="P6"
      hours="13–17"
      description="The two-step creation wizard — scope then employee selection, with the payrun created only on the final step — plus the Compute → Validate → Mark Paid lifecycle."
      buildsOn={[
        "P3 Contracts — the period-applicable contract each payslip computes from",
        "P6 Salary Structures and Rules — the sequenced rules that drive every amount",
      ]}
    />
  )
}
