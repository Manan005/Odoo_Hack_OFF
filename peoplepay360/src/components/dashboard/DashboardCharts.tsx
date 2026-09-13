"use client"

import { useSyncExternalStore } from "react"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { useReducedMotion } from "@/components/dashboard/use-reduced-motion"
import { formatINR, formatLakh } from "@/lib/money"

const AXIS = { fontSize: 11, fill: "var(--color-muted-foreground)" }
const GRID = "var(--color-chart-grid)"
/**
 * Removes the zero-width first frame before ResponsiveContainer measures.
 * Sized for the narrowest card (a phone), so the frame never exceeds its
 * container; ChartCard clips it while the real measurement lands.
 */
const INITIAL = { width: 320, height: 240 }

/** Recharts animates in JS, so the CSS kill switch needs a hand here. */
function useAnim() {
  const reduced = useReducedMotion()
  return {
    isAnimationActive: !reduced,
    animationDuration: 900,
    animationEasing: "ease-out" as const,
  }
}

/** Below md (768). Subscription pattern — no state is set inside an effect. */
const COMPACT_QUERY = "(max-width: 767.98px)"
const subscribeCompact = (onChange: () => void) => {
  const mq = window.matchMedia(COMPACT_QUERY)
  mq.addEventListener("change", onChange)
  return () => mq.removeEventListener("change", onChange)
}
const getCompact = () => window.matchMedia(COMPACT_QUERY).matches
const getCompactServer = () => false

/** `₹ 1.2L` → `1.2L`; the currency is in the tooltip, the axis needs the room. */
const shortLakh = (v: number) => formatLakh(v).replace("₹ ", "")

/**
 * Axis props for the current viewport. A phone chart is ~250px wide, so the
 * Y column narrows and drops the sign, the plot margin closes up, and the X
 * axis keeps only the ticks that fit (always the first and last).
 */
function useAxes() {
  const compact = useSyncExternalStore(subscribeCompact, getCompact, getCompactServer)
  return {
    compact,
    yWidth: compact ? 44 : 64,
    yTick: compact ? shortLakh : formatLakh,
    margin: { top: 8, right: 8, bottom: 4, left: compact ? 0 : 8 },
  }
}

function TooltipBox({
  active,
  payload,
  label,
  formatter,
  swatch,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
  formatter?: (v: number) => string
  /** Overrides the series colour when the fill is a gradient url. */
  swatch?: string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="animate-scale-in rounded-xl border border-border/70 bg-surface-raised px-3 py-2 text-sm shadow-modal">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 tabular">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ background: swatch ?? p.color ?? "var(--color-chart-1)" }}
            aria-hidden
          />
          <span className="text-muted-foreground">{p.name}</span>
          <span className="ml-auto font-semibold">
            {formatter ? formatter(Number(p.value)) : String(p.value)}
          </span>
        </p>
      ))}
    </div>
  )
}

export function SalaryByDepartmentChart({
  data,
}: {
  data: Array<{ department: string; net: number; headcount: number }>
}) {
  const anim = useAnim()
  const axes = useAxes()
  if (data.length === 0) return <EmptyChart>No departments match the selected filters.</EmptyChart>
  if (data.every((d) => d.net === 0)) {
    return (
      <EmptyChart>
        No payslips in this period yet — bars fill in once the payrun is computed.
      </EmptyChart>
    )
  }
  const top = data.reduce((m, d) => Math.max(m, d.net), 0)

  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
      <BarChart data={data} margin={axes.margin} barCategoryGap="30%">
        <defs>
          <linearGradient id="dept-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={1} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        {/*
         * Never `interval={0}`: six department names in a 4-of-12 card at 1024
         * overlap. preserveStartEnd shows every label that fits and drops only
         * a colliding one — the tooltip still names each bar.
         */}
        <XAxis
          dataKey="department"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          interval="preserveStartEnd"
          minTickGap={4}
        />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => axes.yTick(v)}
          width={axes.yWidth}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-hover)", radius: 8 }}
          content={<TooltipBox formatter={(v) => formatINR(v)} swatch="var(--color-chart-1)" />}
        />
        <Bar
          dataKey="net"
          name="Net salary"
          fill="url(#dept-fill)"
          radius={[6, 6, 2, 2]}
          maxBarSize={44}
          {...anim}
        >
          {/* One hue for one metric; the top earner reads at full strength. */}
          {data.map((d) => (
            <Cell key={d.department} fill="url(#dept-fill)" fillOpacity={d.net === top ? 1 : 0.7} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

export function MonthlyTrendChart({
  data,
}: {
  data: Array<{ label: string; net: number }>
}) {
  const anim = useAnim()
  const axes = useAxes()
  if (data.length === 0) return <EmptyChart>No payslip history for the selected filters.</EmptyChart>

  return (
    <ResponsiveContainer width="100%" height="100%" initialDimension={INITIAL}>
      <AreaChart data={data} margin={axes.margin}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          interval={axes.compact ? "preserveStartEnd" : "preserveEnd"}
        />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => axes.yTick(v)}
          width={axes.yWidth}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border-strong)", strokeDasharray: "3 3" }}
          content={<TooltipBox formatter={(v) => formatINR(v)} swatch="var(--color-chart-1)" />}
        />
        <Area
          type="monotone"
          dataKey="net"
          name="Net salary"
          stroke="var(--color-chart-1)"
          strokeWidth={2.25}
          fill="url(#trend-fill)"
          dot={{ r: 3, fill: "var(--color-chart-1)", strokeWidth: 0 }}
          activeDot={{ r: 5, stroke: "var(--color-surface)", strokeWidth: 2 }}
          {...anim}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

const EmptyChart = ({ children }: { children: React.ReactNode }) => (
  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/80 px-6 text-center text-sm text-muted-foreground">
    {children}
  </div>
)
