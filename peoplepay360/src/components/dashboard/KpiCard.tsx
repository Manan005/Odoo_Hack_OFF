import { TrendingDown, TrendingUp } from "lucide-react"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Surface } from "@/components/ui/surface"
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
    <Surface padded interactive className="group relative flex flex-col overflow-hidden">
      <span
        aria-hidden
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary-subtle/60 blur-2xl transition-transform duration-500 ease-out-quart group-hover:scale-150"
      />
      <p className="relative text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
        {label}
      </p>

      <div className="relative mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
        <NumberTicker
          value={value}
          className="text-[30px] font-semibold leading-none tracking-[-0.02em]"
        />
        {typeof delta === "number" && (
          <span
            className={cn(
              "mb-0.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
              positive && "bg-success-subtle text-success ring-success/20",
              negative && "bg-danger-subtle text-danger ring-danger/20",
              !positive && !negative && "bg-neutral-subtle text-neutral ring-neutral/20",
            )}
          >
            {positive && <TrendingUp className="h-3 w-3" aria-hidden />}
            {negative && <TrendingDown className="h-3 w-3" aria-hidden />}
            {positive ? "+" : ""}
            {delta.toFixed(1)}%
          </span>
        )}
      </div>

      {typeof delta === "number" && (
        <p className="relative mt-1 text-[11px] text-subtle-foreground">vs previous period</p>
      )}
      {caption && <p className="relative mt-1 text-xs text-muted-foreground">{caption}</p>}

      {source && (
        <div className="relative mt-auto pt-3">
          <p className="border-t border-border/60 pt-2.5 text-[11px] text-subtle-foreground">
            Source · {source}
          </p>
        </div>
      )}
    </Surface>
  )
}
