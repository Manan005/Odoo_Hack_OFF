import { Role } from "@prisma/client"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { SalaryRuleForm } from "@/components/payroll/SalaryRuleForm"
import { canEditSalaryConfig, pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { CATEGORY_LABEL } from "@/lib/validation/payroll"

export default async function RuleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Salary rules are restricted to payroll roles." />

  const { id } = await params
  const rule = await db.salaryRule.findUnique({
    where: { id },
    include: { structure: { select: { id: true, name: true } } },
  })
  if (!rule) notFound()

  const [structures, siblings] = await Promise.all([
    db.salaryStructure.findMany({
      where: { companyId: user.companyId },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    db.salaryRule.findMany({
      where: { structureId: rule.structureId, id: { not: rule.id } },
      select: { code: true },
      orderBy: { sequence: "asc" },
    }),
  ])

  const editable = canEditSalaryConfig(user)

  return (
    <>
      <FormHeader
        breadcrumb="Salary Rules"
        backHref="/payroll/rules"
        title={rule.name}
        subtitle={`${rule.structure.name} · ${CATEGORY_LABEL[rule.category]} · sequence ${rule.sequence}`}
        badge={<ActiveBadge active={rule.active} />}
      />

      {!editable && (
        <p className="mb-5 rounded-md bg-info-subtle px-4 py-3 text-xs text-info">
          Salary configuration is read-only for your role. HR Payroll Manager access is required
          to change it.
        </p>
      )}

      <SalaryRuleForm
        initial={{
          id: rule.id,
          structureId: rule.structureId,
          name: rule.name,
          code: rule.code,
          category: rule.category,
          sequence: String(rule.sequence),
          computationType: rule.computationType,
          amount: rule.amount === null ? "" : String(rule.amount),
          percentage: rule.percentage === null ? "" : String(rule.percentage),
          percentageBase: rule.percentageBase ?? "",
          baseRuleCode: rule.baseRuleCode ?? "",
          formula: rule.formula ?? "",
          quantity: String(rule.quantity),
          condition: rule.condition ?? "",
          active: rule.active,
        }}
        structures={structures}
        siblingCodes={siblings.map((s) => s.code)}
        readOnly={!editable}
      />
    </>
  )
}
