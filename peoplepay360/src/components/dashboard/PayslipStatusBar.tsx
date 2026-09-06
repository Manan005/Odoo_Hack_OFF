import type { CSSProperties } from "react"
import {
  PAYSLIP_STATUS_FILL,
  PAYSLIP_STATUS_LABEL,
  PAYSLIP_STATUS_ORDER,
} from "@/components/dashboard/payslip-status"
import type { StatusSplit } from "@/lib/dashboard/aggregate"
import { cn } from "@/lib/utils"

/**
 * Six-pixel segmented bar of payslip statuses for the period — the donut,
 * folded into the card. Segments grow in sequence; the legend carries the
 * counts so colour is never the only signal.
 */
export function PayslipStatusBar({
  split,
  className,
}: {
  split: StatusSplit[]
  className?: string
}) {
  const total = split.reduce((n, s) => n + s.count, 0)
  if (total === 0) {
    return (
      <p
        className={cn(
          "mt-3 rounded-lg border border-dashed border-border/80 px-3 py-2 text-[11px] text-muted-foreground",
          className,
        )}
      >
        No payslips in this period yet.
      </p>
    )
  }

  // Known statuses in lifecycle order first, anything unexpected after.
  const known = PAYSLIP_STATUS_ORDER.map((s) => split.find((x) => x.status === s)).filter(
    (s): s is StatusSplit => Boolean(s && s.count > 0),
  )
  const rest = split.filter((s) => !PAYSLIP_STATUS_ORDER.includes(s.status as never) && s.count > 0)
  const ordered = [...known, ...rest]

  return (
    <div className={cn("mt-3", className)}>
      <div
        className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-surface-muted"
        role="img"
        aria-label={ordered.map((s) => `${s.count} ${PAYSLIP_STATUS_LABEL[s.status] ?? s.status.toLowerCase()}`).join(", ")}
      >
        {ordered.map((s, i) => (
          <span
            key={s.status}
            className={cn("grow-rail h-full rounded-full", PAYSLIP_STATUS_FILL[s.status] ?? "bg-neutral")}
            style={{ width: `${(s.count / total) * 100}%`, ["--delay" as string]: `${i * 90}ms` } as CSSProperties}
          />
        ))}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
        {ordered.map((s) => (
          <li key={s.status} className="inline-flex items-center gap-1.5">
            <span
              className={cn("h-1.5 w-1.5 rounded-full", PAYSLIP_STATUS_FILL[s.status] ?? "bg-neutral")}
              aria-hidden
            />
            <span className="tabular font-medium text-foreground">{s.count}</span>
            {PAYSLIP_STATUS_LABEL[s.status] ?? s.status.toLowerCase()}
          </li>
        ))}
      </ul>
    </div>
  )
}
