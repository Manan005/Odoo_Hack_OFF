import { Role } from "@prisma/client"
import { ComingInPhase } from "@/components/shared/ComingInPhase"
import { Forbidden } from "@/components/shared/Forbidden"
import { pageAllows } from "@/lib/auth-guard"

export const metadata = { title: "Salary Structures — PeoplePay360" }

// P6 replaces this stub.
export default async function SalaryStructuresPage() {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Salary structures are restricted to payroll roles." />

  return (
    <ComingInPhase
      title="Salary Structures"
      phase="P6"
      hours="13–17"
      description="Containers for an ordered collection of salary rules. The structure chosen on a payrun decides which rules compute its payslips."
    />
  )
}
