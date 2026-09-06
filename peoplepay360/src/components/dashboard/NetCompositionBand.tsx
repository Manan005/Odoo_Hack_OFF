import type { CSSProperties } from "react"
import { Surface } from "@/components/ui/surface"
import type { NetComposition } from "@/lib/dashboard/aggregate"
import { formatINR, formatLakh } from "@/lib/money"
import { cn } from "@/lib/utils"

const share = (part: number, whole: number) =>
  whole > 0 ? Math.max(0, Math.min(100, (part / whole) * 100)) : 0

const delay = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as CSSProperties

/**
 * The payroll formula as one bar: basic and allowances build the gross in the
 * two brand-stripe colours, deductions are hatched off the right end, and a
 * hairline marks where the net lands. Every segment is a summed column.
 */
export function NetCompositionBand({
  data,
  periodLabel,
  className,
}: {
  data: NetComposition
  periodLabel: string
  className?: string
}) {
  const { basic, allowances, gross, deductions, net, payslips } = data
  const empty = gross <= 0
  const basicPct = share(basic, gross)
  const allowPct = share(allowances, gross)
  const dedPct = share(deductions, gross)
  const netPct = share(net, gross)

  const legend = [
    { key: "basic", label: "Basic", amount: basic, pct: basicPct, swatch: "bg-chart-1" },
    { key: "allowances", label: "Allowances", amount: allowances, pct: allowPct, swatch: "bg-chart-5" },
    { key: "deductions", label: "Deductions", amount: deductions, pct: dedPct, swatch: "comp-hatch" },
    { key: "net", label: "Net", amount: net, pct: netPct, swatch: "bg-foreground" },
  ]

  return (
    <Surface as="section" padded className={cn("min-w-0", className)} aria-labelledby="net-composition">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="net-composition" className="text-[15px] font-semibold tracking-tight">
          Net composition
        </h2>
        <p className="text-[11px] text-subtle-foreground">
          Source · Payslip roll-ups — basic + allowances = gross · gross − deductions = net
        </p>
      </div>

      {empty ? (
        <p className="mt-4 rounded-xl border border-dashed border-border/80 px-4 py-5 text-center text-xs text-muted-foreground">
          No payslips in {periodLabel} — the band fills in once a payrun is computed.
        </p>
      ) : (
        <>
          <div className="relative mt-5 h-5">
            <span
              className="rise-in absolute -translate-x-1/2 whitespace-nowrap text-[11px] font-medium tabular"
              style={{ left: `${netPct}%`, ...delay(560) }}
            >
              Net {formatLakh(net)}
            </span>
          </div>

          <div
            className="relative h-9 w-full overflow-hidden rounded-lg bg-surface-muted"
            role="img"
            aria-label={`Basic ${formatINR(basic, 0)}, allowances ${formatINR(allowances, 0)}, deductions ${formatINR(deductions, 0)}, net ${formatINR(net, 0)}`}
          >
            <span
              className="grow-rail absolute inset-y-0 left-0 bg-chart-1"
              style={{ width: `${basicPct}%` }}
            />
            <span
              className="grow-rail absolute inset-y-0 bg-chart-5"
              style={{ left: `${basicPct}%`, width: `${allowPct}%`, ...delay(120) }}
            />
            <span
              className="grow-rail-right comp-hatch absolute inset-y-0 right-0"
              style={{ width: `${dedPct}%`, ...delay(260) }}
            />
            <span
              className="rise-in absolute inset-y-0 w-0.5 bg-foreground"
              style={{ left: `calc(${netPct}% - 1px)`, ...delay(560) }}
            />
          </div>

          <ul className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
            {legend.map((l, i) => (
              <li key={l.key} className="rise-in flex items-center gap-2.5" style={delay(320 + i * 80)}>
                <span className={cn("h-2.5 w-2.5 shrink-0 rounded-sm", l.swatch)} aria-hidden />
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">
                    {l.label}{" "}
                    <span className="tabular text-subtle-foreground">· {l.pct.toFixed(0)}% of gross</span>
                  </p>
                  <p className="tabular text-sm font-semibold">{formatINR(l.amount, 0)}</p>
                </div>
              </li>
            ))}
          </ul>

          <p className="mt-3 border-t border-border/60 pt-2.5 text-[11px] text-subtle-foreground tabular">
            {formatINR(gross, 0)} gross − {formatINR(deductions, 0)} deductions ={" "}
            {formatINR(net, 0)} net across {payslips} payslips in {periodLabel}
          </p>
        </>
      )}
    </Surface>
  )
}
