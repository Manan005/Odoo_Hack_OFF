import { AlertTriangle, ArrowUpRight, Info, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { PanelCard } from "@/components/dashboard/ChartCard"
import { NumberTicker } from "@/components/ui/number-ticker"
import type {
  AlertRow,
  AttendanceOverview,
  DepartmentOverviewRow,
  TimeOffOverviewRow,
} from "@/lib/dashboard/aggregate"
import { formatDuration, formatLakh } from "@/lib/money"
import { cn } from "@/lib/utils"

const Stat = ({
  label,
  value,
  tone,
}: {
  label: string
  value: string | number
  tone?: string
}) => (
  <div className="rounded-xl bg-surface-muted/70 px-3 py-2.5 ring-1 ring-inset ring-border/50">
    <NumberTicker value={String(value)} className={cn("text-xl font-semibold", tone)} />
    <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
  </div>
)

const miniHead =
  "py-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground"

export function AttendancePanel({ data }: { data: AttendanceOverview }) {
  return (
    <PanelCard title="Attendance Overview" source="Attendance">
      <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Present" value={data.present} tone="text-success" />
        <Stat label="Late" value={data.late} tone="text-warning" />
        <Stat label="Absent" value={data.absent} tone="text-danger" />
        <Stat label="Overtime" value={data.overtimeRecords} tone="text-info" />
      </div>
      <dl className="mt-4 space-y-2 border-t border-border/70 pt-3 text-xs">
        {[
          ["Missing check-outs", data.missingCheckOuts],
          ["Manual attendance edits", data.manualEdits],
          ["Overtime hours", data.overtimeHours.toFixed(2)],
          ["Attendance coverage", `${data.coveragePct.toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">{label}</dt>
            <span
              aria-hidden
              className="flex-1 border-b border-dotted border-border/80 translate-y-[-3px]"
            />
            <dd className="tabular font-medium">{value}</dd>
          </div>
        ))}
      </dl>
    </PanelCard>
  )
}

export function TimeOffPanel({ rows }: { rows: TimeOffOverviewRow[] }) {
  return (
    <PanelCard title="Time Off Overview" source="Time Off Requests + Allocations">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border/70">
            <th className={cn(miniHead, "text-left")}>Type</th>
            <th className={cn(miniHead, "text-right")}>Approved</th>
            <th className={cn(miniHead, "text-right")}>Pending</th>
            <th className={cn(miniHead, "text-right")}>Remaining</th>
          </tr>
        </thead>
        <tbody className="stagger-rows">
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-muted-foreground">
                No time off data.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.type}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-hover/60"
            >
              <td className="py-2 font-medium">{r.type}</td>
              <td className="py-2 text-right tabular">
                {formatDuration(r.approvedDays, r.unit as "DAYS" | "HOURS")}
              </td>
              <td className="py-2 text-right tabular">
                {r.pending > 0 ? (
                  <span className="rounded-md bg-warning-subtle px-1.5 py-0.5 font-medium text-warning ring-1 ring-inset ring-warning/25">
                    {r.pending}
                  </span>
                ) : (
                  <span className="text-subtle-foreground">0</span>
                )}
              </td>
              <td className="py-2 text-right tabular">
                {r.remainingBalance === null ? (
                  <span className="text-subtle-foreground">N/A</span>
                ) : (
                  formatDuration(r.remainingBalance, r.unit as "DAYS" | "HOURS")
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelCard>
  )
}

export function DepartmentPanel({ rows }: { rows: DepartmentOverviewRow[] }) {
  const max = rows.reduce((m, r) => Math.max(m, r.monthlySalary), 0)
  return (
    <PanelCard title="Department Overview" source="Employee + Contract">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border/70">
            <th className={cn(miniHead, "text-left")}>Department</th>
            <th className={cn(miniHead, "text-right")}>Headcount</th>
            <th className={cn(miniHead, "w-2/5 text-right")}>Monthly Salary</th>
          </tr>
        </thead>
        <tbody className="stagger-rows">
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-6 text-center text-muted-foreground">
                No departments match.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr
              key={r.department}
              className="border-b border-border/60 transition-colors last:border-0 hover:bg-surface-hover/60"
            >
              <td className="py-2 font-medium">{r.department}</td>
              <td className="py-2 text-right tabular">{r.headcount}</td>
              <td className="py-2 text-right">
                <div className="flex items-center justify-end gap-2">
                  {/* Proportional bar — the real number is beside it. */}
                  <span className="h-1.5 w-full max-w-24 overflow-hidden rounded-full bg-surface-muted">
                    <span
                      className="block h-full origin-left animate-rail rounded-full bg-chart-1"
                      style={{ width: max > 0 ? `${(r.monthlySalary / max) * 100}%` : 0 }}
                    />
                  </span>
                  <span className="tabular font-medium">{formatLakh(r.monthlySalary)}</span>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PanelCard>
  )
}

const ALERT_ICON = {
  BLOCKING: ShieldAlert,
  WARNING: AlertTriangle,
  INFO: Info,
} as const

const ALERT_TONE = {
  BLOCKING: "bg-danger-subtle text-danger ring-danger/20",
  WARNING: "bg-warning-subtle text-warning ring-warning/25",
  INFO: "bg-info-subtle text-info ring-info/20",
} as const

export function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  return (
    <PanelCard title="Payroll Alerts" source="Payrun + Payslip validation">
      {alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 py-6 text-center text-xs text-muted-foreground">
          No payroll warnings in this period.
        </p>
      ) : (
        <ul className="stagger-rows space-y-1.5">
          {alerts.map((a, i) => {
            const Icon = ALERT_ICON[a.severity as keyof typeof ALERT_ICON] ?? Info
            const tone = ALERT_TONE[a.severity as keyof typeof ALERT_TONE] ?? ALERT_TONE.INFO
            return (
              <li
                key={i}
                className={cn(
                  "flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1 ring-inset",
                  tone,
                )}
              >
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                <span className="flex-1 text-foreground/90">{a.message}</span>
                {a.payslipId && (
                  <Link
                    href={`/payroll/payslips/${a.payslipId}`}
                    className="group inline-flex shrink-0 items-center gap-0.5 font-medium hover:underline"
                  >
                    View
                    <ArrowUpRight
                      className="h-3 w-3 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px"
                      aria-hidden
                    />
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </PanelCard>
  )
}
