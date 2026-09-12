import type { TrendPoint } from "@/lib/dashboard/aggregate"
import { formatINR } from "@/lib/money"
import { cn } from "@/lib/utils"

const W = 100
const H = 40
const PAD = 6

/**
 * Server-rendered sparkline over the real monthly buckets from
 * getMonthlyTrend. It never pads a missing month: fewer than two points is a
 * sentence, not a line. Points are HTML so they stay round under
 * preserveAspectRatio="none"; only the stroke and area live in the SVG.
 */
export function Sparkline({
  points,
  className,
}: {
  points: TrendPoint[]
  className?: string
}) {
  if (points.length < 2) {
    return (
      <p
        className={cn(
          "rounded-lg border border-dashed border-ink-fg/20 px-3 py-2.5 text-xs text-ink-fg/60",
          className,
        )}
      >
        {points.length === 1
          ? `Only ${points[0].label} has payslips so far — a trend line needs two months.`
          : "No payslip history yet — the trend line appears after the first payrun."}
      </p>
    )
  }

  const nets = points.map((p) => p.net)
  const min = Math.min(...nets)
  const max = Math.max(...nets)
  const span = max - min
  const coords = points.map((p, i) => ({
    ...p,
    x: (i / (points.length - 1)) * W,
    y: span === 0 ? H / 2 : H - PAD - ((p.net - min) / span) * (H - PAD * 2),
  }))
  const line = coords.map((c) => `${c.x.toFixed(2)},${c.y.toFixed(2)}`).join(" ")
  const area = `${line} ${W},${H} 0,${H}`
  const lastIndex = coords.length - 1

  return (
    <figure className={cn("relative", className)}>
      <div className="relative">
        {/*
         * The draw-on is a clip wipe on the <svg> box, not a stroke dash: with
         * non-scaling-stroke under preserveAspectRatio="none", a dash pattern
         * resolves in device space while pathLength scales in user space, and
         * the mismatch leaves an "off" band in the middle of the line.
         */}
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="spark-svg block h-20 w-full overflow-visible"
          aria-hidden
        >
          <defs>
            <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink-accent)" stopOpacity={0.4} />
              <stop offset="100%" stopColor="var(--ink-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <polygon points={area} fill="url(#spark-fill)" className="spark-area" />
          <polyline
            points={line}
            fill="none"
            stroke="var(--ink-accent)"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {coords.map((c, i) => (
          <span
            key={c.label}
            title={`${c.label} · ${formatINR(c.net)} across ${c.payslips} payslips`}
            className="absolute flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center"
            style={{ left: `${c.x}%`, top: `${(c.y / H) * 100}%` }}
          >
            <span
              className={cn(
                "block rounded-full",
                i === lastIndex ? "spark-dot h-2 w-2" : "h-1 w-1 bg-ink-fg/55",
              )}
            />
          </span>
        ))}
      </div>

      <figcaption className="relative mt-1 h-4">
        {coords.map((c, i) => (
          <span
            key={c.label}
            className={cn(
              "absolute top-0 text-[10px] font-medium uppercase tracking-[0.12em] text-ink-fg/50",
              i === lastIndex ? "-translate-x-full" : i > 0 && "-translate-x-1/2",
            )}
            style={{ left: `${c.x}%` }}
          >
            {c.label}
          </span>
        ))}
        <span className="sr-only">
          Net salary over the last {points.length} months:{" "}
          {points.map((p) => `${p.label} ${formatINR(p.net, 0)}`).join(", ")}
        </span>
      </figcaption>
    </figure>
  )
}
