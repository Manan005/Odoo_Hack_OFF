import type { PayslipStatus } from "@prisma/client"
import { Spotlight } from "@/components/motion/Spotlight"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { NumberTicker } from "@/components/ui/number-ticker"
import { formatINR } from "@/lib/money"

interface Totals {
  basic: unknown
  allowances: unknown
  gross: unknown
  deductions: unknown
  net: unknown
}

const eyebrow = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

/**
 * The payslip's headline: net pay as the hero numeral, gross and deductions
 * beside it. Every figure is a stored roll-up (rules.md §6) — this component
 * formats them and nothing else. The stripe under the net is the three
 * roll-ups handed to CSS as flex weights; the browser draws the proportion.
 */
export function PayslipHero({ totals, status }: { totals: Totals; status: PayslipStatus }) {
  const segments = [
    { key: "basic", label: "Basic", tone: "stripe-basic", dot: "bg-primary", value: totals.basic },
    {
      key: "allowances",
      label: "Allowances",
      tone: "stripe-allowance",
      dot: "bg-success",
      value: totals.allowances,
    },
    {
      key: "deductions",
      label: "Deductions",
      tone: "stripe-deduction",
      dot: "bg-danger",
      value: totals.deductions,
    },
  ] as const

  return (
    <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
      <Spotlight className="pay-tile pay-tile-hero p-5 sm:col-span-2 lg:col-span-1">
        <div className="flex items-center justify-between gap-3">
          <p className={eyebrow}>Net pay</p>
          <StatusBadge status={status} />
        </div>
        <p className="pay-hero-numeral mt-3 text-[2.75rem] text-primary sm:text-[3rem]">
          <NumberTicker value={formatINR(String(totals.net))} delayStep={55} />
        </p>

        <div className="stripe-bar mt-5" aria-hidden>
          {segments.map((s, i) => (
            <span
              key={s.key}
              className={s.tone}
              style={{
                flexGrow: String(s.value),
                ["--seg-delay" as string]: `${400 + i * 120}ms`,
              }}
            />
          ))}
        </div>
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
          {segments.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5 text-[11.5px]">
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
              <span className="text-muted-foreground">{s.label}</span>
              <span className="tabular font-medium">{formatINR(String(s.value))}</span>
            </li>
          ))}
        </ul>
      </Spotlight>

      <Spotlight className="pay-tile p-4">
        <p className={eyebrow}>Gross</p>
        <p className="mt-1.5 text-xl font-semibold tabular">
          <NumberTicker value={formatINR(String(totals.gross))} />
        </p>
      </Spotlight>

      <Spotlight className="pay-tile p-4">
        <p className={eyebrow}>Deductions</p>
        <p className="mt-1.5 text-xl font-semibold tabular text-danger">
          <NumberTicker value={`−${formatINR(String(totals.deductions))}`} />
        </p>
      </Spotlight>
    </div>
  )
}
