import { RuleCategory } from "@prisma/client"
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
  BASIC: "border-l-2 border-primary",
  ALLOWANCE: "border-l-2 border-success",
  GROSS: "border-l-2 border-info bg-surface-muted font-semibold",
  DEDUCTION: "border-l-2 border-danger",
  NET: "border-l-2 border-primary bg-primary-subtle font-bold",
}

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
    <section className="rounded-lg border border-border bg-surface shadow-card">
      <h2 className="border-b border-border px-5 py-3 text-[15px] font-semibold">
        Salary Computation
      </h2>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border bg-surface-muted">
              {["Seq", "Rule", "Code", "Category", "Qty", "Rate / Base", "Amount"].map(
                (h, i) => (
                  <th
                    key={h}
                    className={cn(
                      "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                      i === 0 || i === 4 || i === 6 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {lines.length === 0 && (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  Not computed yet — run COMPUTE on the payrun.
                </td>
              </tr>
            )}
            {lines.map((l) => {
              const isDeduction = l.category === RuleCategory.DEDUCTION
              return (
                <tr key={l.id} className={cn("border-b border-border last:border-0", STRIPE[l.category])}>
                  <td className="px-4 py-2.5 text-right text-sm tabular text-muted-foreground">
                    {l.sequence}
                  </td>
                  <td className="px-4 py-2.5 text-sm">{l.name}</td>
                  <td className="px-4 py-2.5 font-mono text-[13px] text-muted-foreground">
                    {l.code}
                  </td>
                  <td className="px-4 py-2.5 text-sm">{CATEGORY_LABEL[l.category]}</td>
                  <td className="px-4 py-2.5 text-right text-sm tabular">
                    {String(l.quantity)}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[12px] text-muted-foreground">
                    {l.rate ?? "—"}
                  </td>
                  <td
                    className={cn(
                      "px-4 py-2.5 text-right text-sm tabular",
                      isDeduction ? "text-danger" : "",
                      l.category === RuleCategory.NET ? "text-base text-primary" : "",
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

      <dl className="grid grid-cols-2 gap-4 border-t border-border bg-surface-muted px-5 py-4 sm:grid-cols-5">
        {([
          ["Basic", totals.basic],
          ["Allowances", totals.allowances],
          ["Gross", totals.gross],
          ["Deductions", totals.deductions],
          ["Net", totals.net],
        ] as const).map(([label, value], i) => (
          <div key={label}>
            <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd
              className={cn(
                "mt-1 tabular",
                i === 4 ? "text-base font-bold text-primary" : "text-sm font-medium",
                i === 3 ? "text-danger" : "",
              )}
            >
              {i === 3 ? "−" : ""}
              {formatINR(String(value))}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
