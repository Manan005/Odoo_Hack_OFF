import { ArrowUpRight, Plus } from "lucide-react"
import Link from "next/link"
import { DeltaChip } from "@/components/dashboard/KpiCard"
import { Sparkline } from "@/components/dashboard/Sparkline"
import { PayrunStepper } from "@/components/payroll/PayrunStepper"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { NumberTicker } from "@/components/ui/number-ticker"
import type { PeriodPayrun, TrendPoint } from "@/lib/dashboard/aggregate"
import { formatINR, formatLakh } from "@/lib/money"
import { cn } from "@/lib/utils"

/**
 * The dashboard's anchor: total net for the period, the real six-month
 * sparkline beneath it, and the period's payrun rail. Ink in dark mode,
 * raised paper in light — `.hero-ink` re-points the ink pair per theme, so
 * the `ink-fg` utilities below follow. The ticker gets the display face; the
 * currency sign stays sans so the glyph never falls back mid-numeral.
 */
export function HeroNetCard({
  periodLabel,
  prevLabel,
  totalNet,
  prevNet,
  deltaPct,
  payslips,
  trend,
  payrun,
  payslipsHref,
  className,
}: {
  periodLabel: string
  prevLabel: string
  totalNet: number
  prevNet: number
  deltaPct: number | null
  payslips: number
  trend: TrendPoint[]
  payrun: PeriodPayrun | null
  payslipsHref: string
  className?: string
}) {
  const compact = formatLakh(totalNet)
  const negative = compact.startsWith("−")
  const figure = compact.replace(/^−?₹\s?/, "")
  const hasPayslips = payslips > 0

  return (
    <article
      className={cn(
        "hero-ink flex flex-col overflow-hidden rounded-2xl border border-ink-fg/10 shadow-raise",
        className,
      )}
      aria-labelledby="hero-net-label"
    >
      <span aria-hidden className="hero-blob" />

      <div className="relative flex flex-1 flex-col p-5">
        <header className="flex items-start justify-between gap-3">
          <p
            id="hero-net-label"
            className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-fg/60"
          >
            Net salary · {periodLabel}
          </p>
          <Link
            href={payslipsHref}
            className="group inline-flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-ink-fg/70 transition-colors duration-150 hover:text-ink-fg"
          >
            All payslips
            <ArrowUpRight
              className="h-3 w-3 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px"
              aria-hidden
            />
          </Link>
        </header>

        <div className="mt-4 flex items-baseline gap-1.5">
          <span className="text-[26px] font-medium leading-none text-ink-fg/70" aria-hidden>
            {negative ? "−" : ""}₹
          </span>
          <NumberTicker
            value={figure}
            delayStep={55}
            className="font-display text-[52px] font-semibold leading-none tracking-[-0.01em]"
          />
          <span className="sr-only">{formatINR(totalNet)}</span>
        </div>

        <div className="mt-3 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-fg/60">
          {hasPayslips ? (
            <>
              <DeltaChip delta={deltaPct} />
              {prevNet > 0 ? (
                <span className="tabular">
                  vs {formatLakh(prevNet)} in {prevLabel}
                </span>
              ) : (
                <span>no payslips in {prevLabel} to compare against</span>
              )}
              <span className="text-ink-fg/30" aria-hidden>
                ·
              </span>
              <span className="tabular">{payslips} payslips</span>
            </>
          ) : (
            <span>
              No payslips in {periodLabel}
              {prevNet > 0 ? ` — ${prevLabel} closed at ${formatLakh(prevNet)}` : ""}.
            </span>
          )}
        </div>

        <Sparkline points={trend} className="mt-5" />

        <footer className="mt-auto border-t border-ink-fg/10 pt-4">
          {payrun ? (
            <>
              <div className="flex items-center justify-between gap-3">
                <Link
                  href={`/payroll/payruns/${payrun.id}`}
                  className="group inline-flex min-w-0 items-center gap-1 text-sm font-medium underline-offset-4 hover:underline"
                >
                  <span className="truncate">{payrun.name}</span>
                  <ArrowUpRight
                    className="h-3.5 w-3.5 shrink-0 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px"
                    aria-hidden
                  />
                </Link>
                <StatusBadge status={payrun.status} />
              </div>
              <div className="ink-scope mt-4">
                <PayrunStepper status={payrun.status} allSent={payrun.allSent} />
              </div>
            </>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-ink-fg/70">No payrun for this period.</p>
              <Link
                href="/payroll/payruns"
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-medium text-primary-fg transition-[opacity,scale] duration-150 ease-out-quart hover:opacity-90 active:scale-[0.98]"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                Create payrun
              </Link>
            </div>
          )}
        </footer>
      </div>
    </article>
  )
}
