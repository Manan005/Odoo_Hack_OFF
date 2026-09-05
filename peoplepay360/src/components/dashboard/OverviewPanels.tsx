import { AlertTriangle, Info, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { PanelCard } from "@/components/dashboard/ChartCard"
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
  <div>
    <p className={cn("text-xl font-bold tabular", tone)}>{value}</p>
    <p className="text-xs text-muted-foreground">{label}</p>
  </div>
)

export function AttendancePanel({ data }: { data: AttendanceOverview }) {
  return (
    <PanelCard title="Attendance Overview" source="Attendance">
      <div className="grid grid-cols-4 gap-3">
        <Stat label="Present" value={data.present} tone="text-success" />
        <Stat label="Late" value={data.late} tone="text-warning" />
        <Stat label="Absent" value={data.absent} tone="text-danger" />
        <Stat label="Overtime" value={data.overtimeRecords} tone="text-info" />
      </div>
      <dl className="mt-4 space-y-1.5 border-t border-border pt-3 text-xs">
        {[
          ["Missing check-outs", data.missingCheckOuts],
          ["Manual attendance edits", data.manualEdits],
          ["Overtime hours", data.overtimeHours.toFixed(2)],
          ["Attendance coverage", `${data.coveragePct.toFixed(1)}%`],
        ].map(([label, value]) => (
          <div key={String(label)} className="flex justify-between">
            <dt className="text-muted-foreground">{label}</dt>
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
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-1.5 text-left font-medium">Type</th>
            <th className="py-1.5 text-right font-medium">Approved</th>
            <th className="py-1.5 text-right font-medium">Pending</th>
            <th className="py-1.5 text-right font-medium">Remaining</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={4} className="py-4 text-center text-muted-foreground">
                No time off data.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.type} className="border-b border-border last:border-0">
              <td className="py-1.5">{r.type}</td>
              <td className="py-1.5 text-right tabular">
                {formatDuration(r.approvedDays, r.unit as "DAYS" | "HOURS")}
              </td>
              <td className="py-1.5 text-right tabular">{r.pending}</td>
              <td className="py-1.5 text-right tabular">
                {r.remainingBalance === null ? (
                  <span className="text-muted-foreground">N/A</span>
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
  return (
    <PanelCard title="Department Overview" source="Employee + Contract">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="border-b border-border text-muted-foreground">
            <th className="py-1.5 text-left font-medium">Department</th>
            <th className="py-1.5 text-right font-medium">Headcount</th>
            <th className="py-1.5 text-right font-medium">Monthly Salary</th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 && (
            <tr>
              <td colSpan={3} className="py-4 text-center text-muted-foreground">
                No departments match.
              </td>
            </tr>
          )}
          {rows.map((r) => (
            <tr key={r.department} className="border-b border-border last:border-0">
              <td className="py-1.5">{r.department}</td>
              <td className="py-1.5 text-right tabular">{r.headcount}</td>
              <td className="py-1.5 text-right tabular font-medium">
                {formatLakh(r.monthlySalary)}
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
  BLOCKING: "text-danger",
  WARNING: "text-warning",
  INFO: "text-info",
} as const

export function AlertsPanel({ alerts }: { alerts: AlertRow[] }) {
  return (
    <PanelCard title="Payroll Alerts" source="Payrun + Payslip validation">
      {alerts.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No payroll warnings in this period.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {alerts.map((a, i) => {
            const Icon = ALERT_ICON[a.severity as keyof typeof ALERT_ICON] ?? Info
            const tone = ALERT_TONE[a.severity as keyof typeof ALERT_TONE] ?? "text-info"
            return (
              <li key={i} className={cn("flex items-start gap-2 text-xs", tone)}>
                <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span className="flex-1">{a.message}</span>
                {a.payslipId && (
                  <Link
                    href={`/payroll/payslips/${a.payslipId}`}
                    className="shrink-0 font-medium hover:underline"
                  >
                    View →
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
