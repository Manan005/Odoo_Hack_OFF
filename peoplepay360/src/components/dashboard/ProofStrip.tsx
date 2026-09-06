import { CalendarCheck, Clock, FileSignature, Receipt, Users } from "lucide-react"
import Link from "next/link"
import { Spotlight } from "@/components/motion/Spotlight"
import { NumberTicker } from "@/components/ui/number-ticker"
import type { ModelCounts } from "@/lib/dashboard/aggregate"

/**
 * Five row counts behind the page, each a link to its list. They re-roll
 * with every filter change — the cheapest visible proof of rules.md §0.3.
 */
export function ProofStrip({
  counts,
  periodLabel,
  payslipsHref,
}: {
  counts: ModelCounts
  periodLabel: string
  payslipsHref: string
}) {
  const tiles = [
    { label: "Active employees", value: counts.employees, icon: Users, href: "/employees", note: "in the current scope" },
    { label: "Running contracts", value: counts.contracts, icon: FileSignature, href: "/contracts", note: "status RUNNING" },
    { label: "Payslips", value: counts.payslips, icon: Receipt, href: payslipsHref, note: periodLabel },
    { label: "Attendance records", value: counts.attendance, icon: Clock, href: "/attendance", note: periodLabel },
    { label: "Approved time off", value: counts.timeOff, icon: CalendarCheck, href: "/time-off/requests?status=APPROVED", note: `requests overlapping ${periodLabel}` },
  ]

  return (
    <section aria-labelledby="proof-strip" className="mt-6">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2
          id="proof-strip"
          className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary"
        >
          Live query proof
        </h2>
        <p className="text-[11px] text-subtle-foreground">
          Every figure on this page is a live query — change a filter and these re-roll.
        </p>
      </div>

      <ul className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 [--stagger-offset:4]">
        {tiles.map((t) => {
          const Icon = t.icon
          return (
            <Spotlight
              as="li"
              key={t.label}
              className="group relative overflow-hidden rounded-xl border border-border/70 bg-surface px-4 py-3 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                <Link
                  href={t.href}
                  className="stretched text-[11px] font-medium [--stretch-radius:var(--radius-xl)] group-hover:text-foreground"
                >
                  {t.label}
                </Link>
              </div>
              <NumberTicker
                value={String(t.value)}
                delayStep={25}
                className="mt-1.5 text-xl font-semibold leading-none tracking-tight"
              />
              <p className="mt-1 truncate text-[10px] text-subtle-foreground">{t.note}</p>
            </Spotlight>
          )
        })}
      </ul>
    </section>
  )
}
