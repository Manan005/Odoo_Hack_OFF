"use client"

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { formatINR, formatLakh } from "@/lib/money"

const AXIS = { fontSize: 12, fill: "var(--color-muted-foreground)" }
const GRID = "var(--color-chart-grid)"

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
  payload?: Array<{ name?: string; value?: number | string }>
  label?: string
  formatter?: (v: number) => string
}) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-surface p-3 text-sm shadow-raise">
      {label && <p className="mb-1 font-medium">{label}</p>}
      {payload.map((p, i) => (
        <p key={i} className="tabular text-muted-foreground">
          {p.name}: {formatter ? formatter(Number(p.value)) : String(p.value)}
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
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
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
          cursor={{ fill: "var(--color-surface-hover)" }}
          content={<TooltipBox formatter={(v) => formatINR(v)} />}
        />
        <Bar dataKey="net" name="Net salary" radius={[4, 4, 0, 0]}>
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
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 8 }}>
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
        <Tooltip content={<TooltipBox formatter={(v) => formatINR(v)} />} />
        <Line
          type="monotone"
          dataKey="net"
          name="Net salary"
          stroke="var(--color-chart-1)"
          strokeWidth={2}
          dot={{ r: 3, fill: "var(--color-chart-1)" }}
          activeDot={{ r: 5 }}
        />
      </LineChart>
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
      <div className="h-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="status"
              innerRadius="58%"
              outerRadius="85%"
              paddingAngle={2}
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
      </div>
      <ul className="w-32 space-y-1.5 text-xs">
        {data.map((d, i) => (
          <li key={d.status} className="flex items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ background: STATUS_COLOR[d.status] ?? SERIES[i % SERIES.length] }}
            />
            <span className="flex-1 capitalize text-muted-foreground">
              {d.status.toLowerCase()}
            </span>
            <span className="tabular font-medium">{d.count}</span>
          </li>
        ))}
        <li className="flex items-center gap-2 border-t border-border pt-1.5 font-medium">
          <span className="flex-1">Total</span>
          <span className="tabular">{total}</span>
        </li>
      </ul>
    </div>
  )
}

const EmptyChart = () => (
  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
    No data for the selected filters.
  </div>
)
