"use client"

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatINR, formatLakh } from "@/lib/money"

const AXIS = { fontSize: 11, fill: "var(--color-muted-foreground)" }
const GRID = "var(--color-chart-grid)"
const ANIM = { animationDuration: 900, animationEasing: "ease-out" as const }

const SERIES = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
]

const STATUS_COLOR: Record<string, string> = {
  PAID: "var(--color-success)",
  VALIDATED: "var(--color-primary)",
  COMPUTED: "var(--color-info)",
  DRAFT: "var(--color-neutral)",
}

function TooltipBox({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean
  payload?: Array<{ name?: string; value?: number | string; color?: string }>
  label?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="animate-scale-in rounded-xl border border-border/70 bg-surface-raised px-3 py-2 text-sm shadow-modal">
      {label && <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2 tabular">
          <span
            className="h-2 w-2 rounded-sm"
            style={{ background: p.color ?? "var(--color-chart-1)" }}
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
  data: Array<{ department: string; net: number }>
}) {
  if (data.length === 0) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }} barCategoryGap="28%">
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="department" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatLakh(v)}
          width={64}
        />
        <Tooltip
          cursor={{ fill: "var(--color-surface-hover)", radius: 8 }}
          content={<TooltipBox formatter={(v) => formatINR(v)} />}
        />
        <Bar dataKey="net" name="Net salary" radius={[6, 6, 2, 2]} maxBarSize={44} {...ANIM}>
          {data.map((_, i) => (
            <Cell key={i} fill={SERIES[i % SERIES.length]} />
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
  if (data.length === 0) return <EmptyChart />
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
        <defs>
          <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-chart-1)" stopOpacity={0.32} />
            <stop offset="100%" stopColor="var(--color-chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} />
        <YAxis
          tick={AXIS}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => formatLakh(v)}
          width={64}
          domain={["auto", "auto"]}
        />
        <Tooltip
          cursor={{ stroke: "var(--color-border-strong)", strokeDasharray: "3 3" }}
          content={<TooltipBox formatter={(v) => formatINR(v)} />}
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
          {...ANIM}
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

export function PayslipStatusChart({
  data,
}: {
  data: Array<{ status: string; count: number }>
}) {
  if (data.length === 0) return <EmptyChart />
  const total = data.reduce((n, d) => n + d.count, 0)
  return (
    <div className="flex h-full items-center gap-4">
      <div className="relative h-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={3}
              cornerRadius={5}
              stroke="var(--color-surface)"
              strokeWidth={2}
              {...ANIM}
            >
              {data.map((d, i) => (
                <Cell
                  key={d.status}
                  fill={STATUS_COLOR[d.status] ?? SERIES[i % SERIES.length]}
                />
              ))}
            </Pie>
            <Tooltip content={<TooltipBox />} />
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-semibold leading-none tracking-tight tabular">{total}</span>
          <span className="mt-1 text-[10px] uppercase tracking-wider text-subtle-foreground">
            payslips
          </span>
        </div>
      </div>
      <ul className="w-36 space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: STATUS_COLOR[d.status] ?? SERIES[i % SERIES.length] }}
              aria-hidden
            />
            <span className="flex-1 capitalize text-muted-foreground">
              {d.status.toLowerCase()}
            </span>
            <span className="tabular font-medium">{d.count}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

const EmptyChart = () => (
  <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-border/80 text-sm text-muted-foreground">
    No data for the selected filters.
  </div>
)
