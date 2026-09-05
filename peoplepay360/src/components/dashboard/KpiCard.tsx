import { TrendingDown, TrendingUp } from "lucide-react"
import { cn } from "@/lib/utils"

export function KpiCard({
  label,
  value,
  delta,
  caption,
  source,
}: {
  label: string
  value: string
  /** Percentage change against the previous period; null when there is none. */
  delta?: number | null
  caption?: string
  source?: string
}) {
  const positive = typeof delta === "number" && delta > 0
  const negative = typeof delta === "number" && delta < 0

  return (
    <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-[28px] font-bold leading-tight tabular">{value}</p>

      {typeof delta === "number" && (
        <p
          className={cn(
            "mt-1 flex items-center gap-1 text-xs font-medium",
            positive && "text-success",
            negative && "text-danger",
            !positive && !negative && "text-muted-foreground",
          )}
        >
          {positive && <TrendingUp className="h-3.5 w-3.5" />}
          {negative && <TrendingDown className="h-3.5 w-3.5" />}
          {positive ? "+" : ""}
          {delta.toFixed(1)}% vs previous period
        </p>
      )}

      {caption && <p className="mt-1 text-xs text-muted-foreground">{caption}</p>}
      {source && <p className="mt-2 text-[11px] text-subtle-foreground">Source: {source}</p>}
    </div>
  )
}
