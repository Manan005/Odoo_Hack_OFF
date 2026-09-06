import { NumberTicker } from "@/components/ui/number-ticker"
import { cn } from "@/lib/utils"

export type StatTone = "primary" | "success" | "warning" | "neutral"

export interface RecordStat {
  label: string
  /** A figure the page already holds — a query result or a count over the rows it fetched. */
  value: number
  tone?: StatTone
}

const DOT: Record<StatTone, string> = {
  primary: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  neutral: "bg-neutral",
}

const nf = new Intl.NumberFormat("en-IN")

/**
 * Stat chips for the record lists (employees, contracts, users…). Server
 * component: the roll is CSS, so nothing here needs a client boundary. Every
 * value is real — rules.md §6 forbids an invented count, so callers pass only
 * what they queried.
 */
export function RecordStats({ stats, className }: { stats: RecordStat[]; className?: string }) {
  if (stats.length === 0) return null
  return (
    <div className={cn("stagger flex flex-wrap items-center gap-1.5", className)}>
      {stats.map((s) => (
        <span
          key={s.label}
          className="inline-flex h-8 items-center gap-2 rounded-lg bg-surface px-2.5 text-xs shadow-card ring-1 ring-inset ring-border/70"
        >
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", DOT[s.tone ?? "neutral"])} />
          <NumberTicker value={nf.format(s.value)} className="text-[13px] font-semibold" />
          <span className="text-muted-foreground">{s.label}</span>
        </span>
      ))}
    </div>
  )
}
