import { Role } from "@prisma/client"
import { Calculator, Plus, Users } from "lucide-react"
import Link from "next/link"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader, FormSection } from "@/components/shared/FormHeader"
import { SmartButtonBar } from "@/components/shared/SmartButtonBar"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { RuleCard } from "@/components/payroll/RuleCard"
import { Button } from "@/components/ui/button"
import { canEditSalaryConfig, pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

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
  const activeRules = structure.rules.filter((r) => r.active).length

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
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">
              Salary rules in execution order
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-semibold tabular text-foreground">{activeRules}</span> active
              of {structure.rules.length} · lower sequence runs first, so Gross and Net can read the
              codes computed before them.
            </p>
          </div>
          {editable && (
            <Link href={`/payroll/rules/new?structureId=${structure.id}`}>
              <Button size="sm" variant="soft">
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Add Rule
              </Button>
            </Link>
          )}
        </div>

        {structure.rules.length === 0 ? (
          <p className="px-3 py-8 text-center text-sm text-muted-foreground">
            No rules yet — a structure with no rules produces an empty payslip.
          </p>
        ) : (
          <ul className="stagger space-y-2">
            {structure.rules.map((r) => (
              <RuleCard
                key={r.id}
                rule={r}
                href={`/payroll/rules/${r.id}`}
                actionLabel={editable ? "Edit" : "View"}
              />
            ))}
          </ul>
        )}
      </FormSection>
    </>
  )
}
