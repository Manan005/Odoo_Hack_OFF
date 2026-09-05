import { ComputationType, PercentageBase, Role } from "@prisma/client"
import { Calculator, Plus, Users } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader, FormSection } from "@/components/shared/FormHeader"
import { SmartButtonBar } from "@/components/shared/SmartButtonBar"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { canEditSalaryConfig, pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { CATEGORY_LABEL } from "@/lib/validation/payroll"

export default async function StructureDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Salary structures are restricted to payroll roles." />

  const { id } = await params
  const structure = await db.salaryStructure.findUnique({
    where: { id },
    include: {
      rules: { orderBy: { sequence: "asc" } },
      _count: { select: { contracts: true, payruns: true } },
    },
  })
  if (!structure) notFound()

  const editable = canEditSalaryConfig(user)

  const describe = (r: (typeof structure.rules)[number]) => {
    switch (r.computationType) {
      case ComputationType.FIXED:
        return `fixed ${r.amount}`
      case ComputationType.PERCENTAGE: {
        const base =
          r.percentageBase === PercentageBase.RULE_CODE
            ? (r.baseRuleCode ?? "?")
            : r.percentageBase === PercentageBase.CONTRACT_WAGE
              ? "wage"
              : (r.percentageBase ?? "wage")
        return `${r.percentage}% × ${base}`
      }
      case ComputationType.FORMULA:
        return r.formula ?? "formula"
      default:
        return "—"
    }
  }

  return (
    <>
      <FormHeader
        breadcrumb="Salary Structures"
        backHref="/payroll/structures"
        title={structure.name}
        subtitle={structure.note ?? undefined}
        badge={<ActiveBadge active={structure.active} />}
        smartButtons={
          <SmartButtonBar
            buttons={[
              {
                label: "Rules",
                count: structure.rules.length,
                href: `/payroll/rules?structureId=${structure.id}`,
                icon: Calculator,
              },
              {
                label: "Employees",
                count: structure._count.contracts,
                href: `/contracts?structureId=${structure.id}`,
                icon: Users,
              },
            ]}
          />
        }
      />

      <FormSection>
        <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-[15px] font-semibold">Salary rules in execution order</h2>
          {editable && (
            <Link href={`/payroll/rules/new?structureId=${structure.id}`}>
              <Button size="sm" variant="ghost">
                <Plus className="h-3.5 w-3.5" />
                Add Rule
              </Button>
            </Link>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["Seq", "Rule", "Code", "Category", "Computation", ""].map((h, i) => (
                  <th
                    key={h || i}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                      i === 0 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {structure.rules.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    No rules yet — a structure with no rules produces an empty payslip.
                  </td>
                </tr>
              )}
              {structure.rules.map((r) => (
                <tr
                  key={r.id}
                  className={`border-b border-border last:border-0 ${
                    r.active ? "" : "opacity-50"
                  }`}
                >
                  <td className="px-3 py-2 text-right text-sm tabular">{r.sequence}</td>
                  <td className="px-3 py-2 text-sm font-medium">{r.name}</td>
                  <td className="px-3 py-2 font-mono text-[13px]">{r.code}</td>
                  <td className="px-3 py-2 text-sm">{CATEGORY_LABEL[r.category]}</td>
                  <td className="px-3 py-2 font-mono text-[12px] text-muted-foreground">
                    {describe(r)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Link
                      href={`/payroll/rules/${r.id}`}
                      className="text-xs text-primary hover:underline"
                    >
                      {editable ? "Edit" : "View"}
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </FormSection>
    </>
  )
}
