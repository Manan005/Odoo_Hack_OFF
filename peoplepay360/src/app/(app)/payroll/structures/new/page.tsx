import { Role } from "@prisma/client"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { StructureForm } from "@/components/payroll/StructureForm"
import { pageAllows } from "@/lib/auth-guard"

export const metadata = { title: "New Salary Structure — PeoplePay360" }

export default async function NewStructurePage() {
  const user = await pageAllows(Role.HR_PAYROLL_MANAGER)
  if (!user) {
    return <Forbidden message="Editing salary structures requires HR Payroll Manager access." />
  }

  return (
    <>
      <PageHeader
        title="New Salary Structure"
        subtitle="Create the container first, then add the rules that compute a payslip."
      />
      <StructureForm initial={{ name: "", active: true, note: "" }} />
    </>
  )
}
