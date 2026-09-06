import { ComputationType, PercentageBase, Role, RuleCategory } from "@prisma/client"
import { Calculator } from "lucide-react"
import { CopyChip } from "@/components/payroll/CopyChip"
import { CATEGORY_CHIP, CATEGORY_RAIL, ruleExpression } from "@/components/payroll/rule-describe"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { canEditSalaryConfig, pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { cn } from "@/lib/utils"
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

const columns: Column<Row>[] = [
  {
    key: "sequence",
    header: "Seq",
    numeric: true,
    className: "w-16",
    render: (r) => (
      <span className="relative inline-flex items-center pl-2.5 font-semibold tabular text-muted-foreground">
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-[3px] rounded-full", CATEGORY_RAIL[r.category])}
        />
        {r.sequence}
      </span>
    ),
  },
  { key: "name", header: "Rule Name", render: (r) => r.name },
  {
    key: "code",
    header: "Code",
    render: (r) => (
      <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground ring-1 ring-inset ring-border/70">
        {r.code}
      </span>
    ),
  },
  {
    key: "category",
    header: "Category",
    render: (r) => (
      <span
        className={cn(
          "rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
          CATEGORY_CHIP[r.category],
        )}
      >
        {CATEGORY_LABEL[r.category]}
      </span>
    ),
  },
  { key: "structure", header: "Structure", render: (r) => r.structure.name },
  {
    key: "computation",
    header: "Computation",
    render: (r) => <CopyChip text={ruleExpression(r)} className="max-w-[18rem]" />,
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
