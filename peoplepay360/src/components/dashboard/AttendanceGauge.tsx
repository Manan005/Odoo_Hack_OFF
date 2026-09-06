import type { CSSProperties } from "react"
import { NumberTicker } from "@/components/ui/number-ticker"
import { cn } from "@/lib/utils"

/** The arc covers 270° of the circle; the gap sits at the bottom. */
const SWEEP = 0.75

type Tone = "success" | "warning" | "danger"

/** Display band for the health figure — a colour, not a policy. */
export function gaugeTone(pct: number): Tone {
  if (pct >= 95) return "success"
  if (pct >= 85) return "warning"
  return "danger"
}

const TONE_TEXT: Record<Tone, string> = {
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
}

const clamp = (v: number) => Math.max(0, Math.min(100, v))

/**
 * Server-rendered arc gauge. The value arc's dash is exactly its length, so
 * animating stroke-dashoffset from that length to zero draws it once.
 * The thin outer ring is attendance coverage (records ÷ scheduled days).
 */
export function AttendanceGauge({
  pct,
  coveragePct,
  className,
}: {
  pct: number
  coveragePct: number
  className?: string
}) {
  const value = clamp(pct) * SWEEP
  const coverage = clamp(coveragePct) * SWEEP
  const tone = gaugeTone(pct)

  return (
    <div className={cn("relative mx-auto aspect-square w-full max-w-[172px]", className)}>
      <svg viewBox="0 0 100 100" className="h-full w-full" aria-hidden>
        <g transform="rotate(135 50 50)" fill="none" strokeLinecap="round">
          <circle
            cx={50}
            cy={50}
            r={40}
            pathLength={100}
            stroke="var(--color-surface-muted)"
            strokeWidth={9}
            strokeDasharray="75 100"
          />
          <circle
            cx={50}
            cy={50}
            r={40}
            pathLength={100}
            stroke="currentColor"
            strokeWidth={9}
            strokeDasharray={`${value.toFixed(2)} 100`}
            className={cn("gauge-arc", TONE_TEXT[tone])}
            style={{ ["--v" as string]: value.toFixed(2) } as CSSProperties}
          />
          <circle
            cx={50}
            cy={50}
            r={48}
            pathLength={100}
            stroke="var(--color-border)"
            strokeWidth={2}
            strokeDasharray="75 100"
          />
          <circle
            cx={50}
            cy={50}
            r={48}
            pathLength={100}
            stroke="var(--color-chart-2)"
            strokeWidth={2}
            strokeDasharray={`${coverage.toFixed(2)} 100`}
            className="gauge-ring"
            style={{ ["--v" as string]: coverage.toFixed(2) } as CSSProperties}
          />
        </g>
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center pt-1">
        <NumberTicker
          value={`${pct.toFixed(0)}%`}
          className={cn(
            "text-[32px] font-semibold leading-none tracking-[-0.02em]",
            TONE_TEXT[tone],
          )}
        />
        <span className="mt-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-subtle-foreground">
          health
        </span>
      </div>
    </div>
  )
}
