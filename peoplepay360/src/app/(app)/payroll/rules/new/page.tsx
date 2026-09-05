import { Role } from "@prisma/client"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { SalaryRuleForm, emptyRule } from "@/components/payroll/SalaryRuleForm"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "New Salary Rule — PeoplePay360" }

export default async function NewRulePage({
  searchParams,
}: {
  searchParams: Promise<{ structureId?: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_MANAGER)
  if (!user) {
    return <Forbidden message="Editing salary rules requires HR Payroll Manager access." />
  }

  const { structureId } = await searchParams

  const [structures, siblings] = await Promise.all([
    db.salaryStructure.findMany({
      where: { companyId: user.companyId, active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    structureId
      ? db.salaryRule.findMany({
          where: { structureId },
          select: { code: true },
          orderBy: { sequence: "asc" },
        })
      : [],
  ])

  return (
    <>
      <PageHeader
        title="New Salary Rule"
        subtitle="Rules run in sequence — each one can read the codes computed before it."
      />
      <SalaryRuleForm
        initial={{ ...emptyRule, structureId: structureId ?? "" }}
        structures={structures}
        siblingCodes={siblings.map((s) => s.code)}
      />
    </>
  )
}
