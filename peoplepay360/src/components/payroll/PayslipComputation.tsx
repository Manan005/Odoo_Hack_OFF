import { RuleCategory } from "@prisma/client"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Surface } from "@/components/ui/surface"
import { formatINR } from "@/lib/money"
import { cn } from "@/lib/utils"
import { CATEGORY_LABEL } from "@/lib/validation/payroll"

export interface ComputationLine {
  id: string
  name: string
  code: string
  category: RuleCategory
  sequence: number
  quantity: unknown
  rate: string | null
  amount: unknown
}

const STRIPE: Record<RuleCategory, string> = {
  BASIC: "shadow-[inset_3px_0_0_0_var(--color-primary)]",
  ALLOWANCE: "shadow-[inset_3px_0_0_0_var(--color-success)]",
  GROSS: "shadow-[inset_3px_0_0_0_var(--color-info)] bg-surface-muted/70 font-semibold",
  DEDUCTION: "shadow-[inset_3px_0_0_0_var(--color-danger)]",
  NET: "shadow-[inset_3px_0_0_0_var(--color-primary)] bg-primary-subtle/50 font-bold",
}

const CATEGORY_CHIP: Record<RuleCategory, string> = {
  BASIC: "bg-primary-subtle text-primary ring-primary/20",
  ALLOWANCE: "bg-success-subtle text-success ring-success/20",
  GROSS: "bg-info-subtle text-info ring-info/20",
  DEDUCTION: "bg-danger-subtle text-danger ring-danger/20",
  NET: "bg-primary-subtle text-primary ring-primary/20",
}

const head =
  "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

/**
 * Every amount here traces to a SalaryRule row — there is no hardcoded number
 * in this component (AC-M9-1).
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
      <h2 className="border-b border-border/70 px-5 py-3.5 text-[15px] font-semibold tracking-tight">
        Salary Computation
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-surface-muted/60">
              {["Seq", "Rule", "Code", "Category", "Qty", "Rate / Base", "Amount"].map((h, i) => (
                <th
                  key={h}
                  className={cn(head, i === 0 || i === 4 || i === 6 ? "text-right" : "text-left")}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="stagger-rows">
            {lines.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Not computed yet — run Compute on the payrun.
                </td>
              </tr>
            )}
            {lines.map((l) => {
              const isDeduction = l.category === RuleCategory.DEDUCTION
              const isNet = l.category === RuleCategory.NET
              return (
                <tr
                  key={l.id}
                  className={cn(
                    "border-b border-border/60 transition-colors last:border-0 hover:bg-surface-hover/50",
                    STRIPE[l.category],
                  )}
                >
                  <td className="px-4 py-2.5 text-right text-sm tabular text-subtle-foreground">
                    {l.sequence}
                  </td>
                  <td className="px-4 py-2.5 text-sm">{l.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[12.5px] text-muted-foreground">
                    {l.code}
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                        CATEGORY_CHIP[l.category],
                      )}
                    >
                      {CATEGORY_LABEL[l.category]}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm tabular">{String(l.quantity)}</td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">
                    {l.rate ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right text-sm tabular",
                      isDeduction && "text-danger",
                      isNet && "text-base text-primary",
                    )}
                  >
                    {isDeduction ? "−" : ""}
                    {formatINR(String(l.amount))}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <dl className="stagger grid grid-cols-2 gap-4 border-t border-border/70 bg-surface-muted/50 px-5 py-4 sm:grid-cols-5">
        {(
          [
            ["Basic", totals.basic],
            ["Allowances", totals.allowances],
            ["Gross", totals.gross],
            ["Deductions", totals.deductions],
            ["Net", totals.net],
          ] as const
        ).map(([label, value], i) => {
          const text = `${i === 3 ? "−" : ""}${formatINR(String(value))}`
          return (
            <div key={label} className={cn(i === 4 && "col-span-2 sm:col-span-1")}>
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {label}
              </dt>
              <dd
                className={cn(
                  "mt-1",
                  i === 4 ? "text-lg font-bold text-primary" : "text-sm font-medium",
                  i === 3 && "text-danger",
                )}
              >
                {i === 4 ? <NumberTicker value={text} /> : <span className="tabular">{text}</span>}
              </dd>
            </div>
          )
        })}
      </dl>
    </Surface>
  )
}
