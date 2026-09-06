import { ArrowUpRight, TrendingDown, TrendingUp } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"
import { Spotlight } from "@/components/motion/Spotlight"
import { NumberTicker } from "@/components/ui/number-ticker"
import { cn } from "@/lib/utils"

/** Period-over-period chip. Renders nothing when there is no previous figure. */
export function DeltaChip({
  delta,
  className,
}: {
  delta: number | null | undefined
  className?: string
}) {
  if (typeof delta !== "number") return null
  const positive = delta > 0
  const negative = delta < 0
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset tabular",
        positive && "bg-success-subtle text-success ring-success/20",
        negative && "bg-danger-subtle text-danger ring-danger/20",
        !positive && !negative && "bg-neutral-subtle text-neutral ring-neutral/20",
        className,
      )}
    >
      {positive && <TrendingUp className="h-3 w-3" aria-hidden />}
      {negative && <TrendingDown className="h-3 w-3" aria-hidden />}
      {positive ? "+" : ""}
      {delta.toFixed(1)}%
    </span>
  )
}

/**
 * Secondary KPI tile. The cursor spotlight is a client leaf; everything else
 * renders on the server. A card lifts on hover only when it is a real link —
 * the `href` stretches over the whole tile through a single anchor.
 */
export function KpiCard({
  label,
  value,
  valueClassName,
  delta,
  deltaCaption,
  caption,
  source,
  href,
  hrefLabel,
  className,
  children,
}: {
  label: string
  /** Already-formatted figure; omit when a child visual carries the number. */
  value?: string
  valueClassName?: string
  /** Percentage change against the previous period; null when there is none. */
  delta?: number | null
  /** Sits under the figure, e.g. "vs 22 in Jul". */
  deltaCaption?: string
  caption?: string
  source?: string
  href?: string
  hrefLabel?: string
  className?: string
  children?: ReactNode
}) {
  return (
    <Spotlight
      as="article"
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border/70 bg-surface p-5 shadow-card",
        href &&
          "transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise",
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {href ? (
            <Link href={href} className="stretched">
              {label}
              <span className="sr-only"> — {hrefLabel ?? "open"}</span>
            </Link>
          ) : (
            label
          )}
        </p>
        {href && (
          <ArrowUpRight
            className="h-3.5 w-3.5 shrink-0 text-subtle-foreground transition-[transform,color] duration-150 ease-out-quart group-hover:-translate-y-px group-hover:translate-x-px group-hover:text-primary"
            aria-hidden
          />
        )}
      </div>

      {value !== undefined && (
        <div className="mt-3 flex flex-wrap items-end gap-x-2 gap-y-1">
          <NumberTicker
            value={value}
            className={cn(
              "text-[30px] font-semibold leading-none tracking-[-0.02em]",
              valueClassName,
            )}
          />
          <DeltaChip delta={delta} className="mb-0.5" />
        </div>
      )}

      {deltaCaption && (
        <p className="mt-1 text-[11px] text-subtle-foreground tabular">{deltaCaption}</p>
      )}

      {children}

      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}

      {source && (
        <div className="mt-auto pt-3">
          <p className="border-t border-border/60 pt-2.5 text-[11px] text-subtle-foreground">
            Source · {source}
          </p>
        </div>
      )}
    </Spotlight>
  )
}
