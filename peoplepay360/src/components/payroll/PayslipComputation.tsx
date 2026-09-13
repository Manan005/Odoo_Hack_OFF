import { RuleCategory } from "@prisma/client"
import { ChevronDown } from "lucide-react"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Surface } from "@/components/ui/surface"
import { formatINR } from "@/lib/money"
import { cn } from "@/lib/utils"
import { CATEGORY_LABEL, COMPUTATION_LABEL } from "@/lib/validation/payroll"
import { LedgerRow } from "./LedgerRow"
import { CATEGORY_CHIP, ruleExpression, type RuleShape } from "./rule-describe"

export interface ComputationLine {
  id: string
  name: string
  code: string
  category: RuleCategory
  sequence: number
  quantity: unknown
  rate: string | null
  amount: unknown
  /** The SalaryRule this line was evaluated from — null if it has since been deleted. */
  rule?: (RuleShape & { condition: string | null }) | null
}

const STRIPE: Record<RuleCategory, string> = {
  BASIC: "shadow-[inset_3px_0_0_0_var(--color-primary)]",
  ALLOWANCE: "shadow-[inset_3px_0_0_0_var(--color-success)]",
  GROSS: "shadow-[inset_3px_0_0_0_var(--color-info)] bg-surface-muted/70 font-semibold",
  DEDUCTION: "shadow-[inset_3px_0_0_0_var(--color-danger)]",
  NET: "shadow-[inset_3px_0_0_0_var(--color-primary)] bg-primary-subtle/50 font-bold",
}

const head =
  "px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:px-4"

/**
 * Below `sm` only Seq, Rule and Amount stay in the table so the net is on
 * screen without a sideways scroll; Code, Category, Qty and Rate fold into
 * the formula peek. Rate / Base returns at `lg` — seven columns do not fit
 * the 720px a tablet leaves without the rule names wrapping.
 */
const COLUMNS: ReadonlyArray<{ label: string; numeric?: boolean; show?: string }> = [
  { label: "Seq", numeric: true },
  { label: "Rule" },
  { label: "Code", show: "hidden sm:table-cell" },
  { label: "Category", show: "hidden sm:table-cell" },
  { label: "Qty", numeric: true, show: "hidden sm:table-cell" },
  { label: "Rate / Base", show: "hidden lg:table-cell" },
  { label: "Amount", numeric: true },
]

/** Milliseconds between one ledger line landing and the next. */
const ROW_STEP = 70

/**
 * Every amount here traces to a SalaryRule row — there is no hardcoded number
 * in this component (AC-M9-1). The lines ledger in one by one; hovering,
 * focusing or tapping a line unfolds the rule's working underneath its name.
 */
export function PayslipComputation({
  lines,
  totals,
}: {
  lines: ComputationLine[]
  totals: {
    basic: unknown
    allowances: unknown
    gross: unknown
    deductions: unknown
    net: unknown
  }
}) {
  return (
    <Surface as="section" className="overflow-hidden">
      <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 px-4 py-3.5 sm:px-5">
        <h2 className="text-[15px] font-semibold tracking-tight">Salary Computation</h2>
        {lines.length > 0 && (
          <p className="text-xs text-muted-foreground">
            <span className="font-semibold tabular text-foreground">{lines.length}</span> rules
            evaluated in sequence · <span className="sm:hidden">tap</span>
            <span className="hidden sm:inline">hover</span> a line to see its working
          </p>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-surface-muted/60">
              {COLUMNS.map((c) => (
                <th
                  key={c.label}
                  className={cn(head, c.numeric ? "text-right" : "text-left", c.show)}
                >
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="ledger-rows">
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Not computed yet — run Compute on the payrun.
                </td>
              </tr>
            )}
            {lines.map((l, i) => {
              const isDeduction = l.category === RuleCategory.DEDUCTION
              const isNet = l.category === RuleCategory.NET
              const amount = `${isDeduction ? "−" : ""}${formatINR(String(l.amount))}`
              return (
                <LedgerRow
                  key={l.id}
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-0 hover:bg-surface-hover/50 focus-visible:outline-none focus-visible:bg-surface-hover/50",
                    STRIPE[l.category],
                  )}
                  style={{ ["--row-delay" as string]: `${i * ROW_STEP}ms` }}
                >
                  <td className="px-3 py-2.5 text-right align-top text-sm tabular text-subtle-foreground sm:px-4">
                    {l.sequence}
                  </td>
                  <td className="px-3 py-2.5 align-top text-sm sm:px-4">
                    <span className="inline-flex items-center gap-1.5">
                      {l.name}
                      <ChevronDown
                        className="ledger-chevron h-3.5 w-3.5 shrink-0 text-subtle-foreground"
                        aria-hidden
                      />
                    </span>
                    <div className="formula-peek">
                      <div>
                        <FormulaPeek line={l} />
                      </div>
                    </div>
                  </td>
                  <td className="hidden px-4 py-2.5 align-top sm:table-cell">
                    <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[12px] text-muted-foreground ring-1 ring-inset ring-border/70">
                      {l.code}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 align-top sm:table-cell">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                        CATEGORY_CHIP[l.category],
                      )}
                    >
                      {CATEGORY_LABEL[l.category]}
                    </span>
                  </td>
                  <td className="hidden px-4 py-2.5 text-right align-top text-sm tabular sm:table-cell">
                    {String(l.quantity)}
                  </td>
                  <td className="hidden px-4 py-2.5 align-top font-mono text-[12px] text-muted-foreground lg:table-cell">
                    {l.rate ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2.5 text-right align-top text-sm tabular sm:px-4",
                      isDeduction && "text-danger",
                      isNet && "text-base text-primary",
                    )}
                  >
                    <NumberTicker value={amount} delayStep={28} />
                  </td>
                </LedgerRow>
              )
            })}
          </tbody>
        </table>
      </div>

      <dl className="stagger grid grid-cols-2 gap-4 border-t border-border/70 bg-surface-muted/50 px-4 py-3.5 sm:grid-cols-5 sm:px-5">
        {(
          [
            ["Basic", totals.basic],
            ["Allowances", totals.allowances],
            ["Gross", totals.gross],
            ["Deductions", totals.deductions],
            ["Net", totals.net],
          ] as const
        ).map(([label, value], i) => (
          <div key={label} className={cn(i === 4 && "col-span-2 sm:col-span-1")}>
            <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </dt>
            <dd
              className={cn(
                "mt-0.5 text-sm tabular",
                i === 4 ? "font-bold text-primary" : "font-medium",
                i === 3 && "text-danger",
              )}
            >
              {i === 3 ? "−" : ""}
              {formatINR(String(value))}
            </dd>
          </div>
        ))}
      </dl>
    </Surface>
  )
}

/**
 * What the row is hiding: the method, the expression, the condition. Reads
 * the stored rule columns only — if the rule is gone, we say so rather than
 * guess.
 */
function FormulaPeek({ line }: { line: ComputationLine }) {
  const rule = line.rule
  return (
    <div className="space-y-1 pt-1.5 text-[11.5px] text-muted-foreground">
      {/* The columns the narrower layouts fold away (see COLUMNS): code,
          category and quantity below `sm`, the rate below `lg`. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 lg:hidden">
        <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] ring-1 ring-inset ring-border/70 sm:hidden">
          {line.code}
        </span>
        <span
          className={cn(
            "rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ring-1 ring-inset sm:hidden",
            CATEGORY_CHIP[line.category],
          )}
        >
          {CATEGORY_LABEL[line.category]}
        </span>
        <span className="tabular sm:hidden">qty {String(line.quantity)}</span>
        {line.rate && <span className="font-mono">{line.rate}</span>}
      </p>

      {rule ? (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-medium text-foreground/80">
            {COMPUTATION_LABEL[rule.computationType]}
          </span>
          <span aria-hidden className="text-subtle-foreground">
            ·
          </span>
          <code className="rounded-md bg-primary-subtle/70 px-1.5 py-0.5 font-mono text-[11.5px] text-primary ring-1 ring-inset ring-primary/15">
            {ruleExpression(rule)}
          </code>
          {rule.condition && (
            <>
              <span className="text-subtle-foreground">when</span>
              <code className="font-mono text-[11.5px] text-foreground/80">{rule.condition}</code>
            </>
          )}
        </div>
      ) : (
        <p>
          {CATEGORY_LABEL[line.category]} line · the rule that produced it is no longer in the
          structure.
        </p>
      )}
    </div>
  )
}
