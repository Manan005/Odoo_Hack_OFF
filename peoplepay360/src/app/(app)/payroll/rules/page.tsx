import { ComputationType, PercentageBase, Role, RuleCategory } from "@prisma/client"
import { Calculator } from "lucide-react"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { canEditSalaryConfig, pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { CATEGORY_LABEL } from "@/lib/validation/payroll"

export const metadata = { title: "Salary Rules — PeoplePay360" }

type Row = {
  id: string
  name: string
  code: string
  category: RuleCategory
  sequence: number
  computationType: ComputationType
  amount: unknown
  percentage: unknown
  percentageBase: PercentageBase | null
  baseRuleCode: string | null
  formula: string | null
  active: boolean
  structure: { name: string }
}

const describe = (r: Row): string => {
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
      return `${r.percentage}% of ${base}`
    }
    case ComputationType.FORMULA:
      return r.formula ?? "formula"
    default:
      return "—"
  }
}

const columns: Column<Row>[] = [
  { key: "sequence", header: "Seq", numeric: true, render: (r) => r.sequence },
  { key: "name", header: "Rule Name", render: (r) => r.name },
  {
    key: "code",
    header: "Code",
    render: (r) => <span className="font-mono text-[13px]">{r.code}</span>,
  },
  { key: "category", header: "Category", render: (r) => CATEGORY_LABEL[r.category] },
  { key: "structure", header: "Structure", render: (r) => r.structure.name },
  {
    key: "computation",
    header: "Computation",
    render: (r) => (
      <span className="font-mono text-[12px] text-muted-foreground">{describe(r)}</span>
    ),
  },
  { key: "active", header: "Active", render: (r) => <ActiveBadge active={r.active} /> },
]

export default async function RulesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; structureId?: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Salary rules are restricted to payroll roles." />

  const { q, structureId } = await searchParams

  const [rules, filterStructure] = await Promise.all([
    db.salaryRule.findMany({
      where: {
        structure: { companyId: user.companyId },
        ...(structureId ? { structureId } : {}),
        ...(q
          ? {
              OR: [
                { name: { contains: q, mode: "insensitive" as const } },
                { code: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        code: true,
        category: true,
        sequence: true,
        computationType: true,
        amount: true,
        percentage: true,
        percentageBase: true,
        baseRuleCode: true,
        formula: true,
        active: true,
        structure: { select: { name: true } },
      },
      // Sequence is the execution contract — show it that way.
      orderBy: [{ structure: { name: "asc" } }, { sequence: "asc" }],
    }),
    structureId
      ? db.salaryStructure.findUnique({ where: { id: structureId }, select: { name: true } })
      : null,
  ])

  return (
    <>
      <PageHeader
        title="Salary Rules"
        subtitle="Executed in ascending sequence, so Gross and Net can build on earlier codes."
      />

      <ListToolbar
        newHref={canEditSalaryConfig(user) ? "/payroll/rules/new" : undefined}
        searchPlaceholder="Search salary rules…"
        chips={
          filterStructure ? (
            <FilterChip paramKey="structureId" label={`Structure: ${filterStructure.name}`} />
          ) : null
        }
      />

      <DataTable
        columns={columns}
        rows={rules}
        rowKey={(r) => r.id}
        rowHref={(r) => `/payroll/rules/${r.id}`}
        empty={
          <EmptyState
            icon={Calculator}
            title="No salary rules yet"
            description="Rules are what actually produce every amount on a payslip."
          />
        }
        footer={<RowCount shown={rules.length} total={rules.length} />}
      />
    </>
  )
}
