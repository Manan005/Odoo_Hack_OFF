import { AlertTriangle, ArrowUpRight, Info, ShieldAlert } from "lucide-react"
import Link from "next/link"
import type { CSSProperties } from "react"
import { PanelCard } from "@/components/dashboard/ChartCard"
import { Spotlight } from "@/components/motion/Spotlight"
import { NumberTicker } from "@/components/ui/number-ticker"
import type {
  AlertRow,
  AttendanceOverview,
  DepartmentOverviewRow,
  TimeOffOverviewRow,
  WarningSeverityCounts,
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
  <Spotlight className="relative overflow-hidden rounded-xl bg-surface-muted/70 px-3 py-2.5 ring-1 ring-inset ring-border/50">
    <NumberTicker value={String(value)} className={cn("text-xl font-semibold", tone)} />
    <p className="mt-1 text-[11px] text-muted-foreground">{label}</p>
  </Spotlight>
)

const miniHead =
  "py-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtle-foreground"

const delay = (ms: number) => ({ ["--delay" as string]: `${ms}ms` }) as CSSProperties

export function AttendancePanel({
  data,
  className,
}: {
  data: AttendanceOverview
  className?: string
}) {
  const total = data.present + data.late + data.halfDay + data.absent
  const segments = [
    { key: "present", label: "present", count: data.present, fill: "bg-success" },
    { key: "late", label: "late", count: data.late, fill: "bg-warning" },
    { key: "halfDay", label: "half day", count: data.halfDay, fill: "bg-info" },
    { key: "absent", label: "absent", count: data.absent, fill: "bg-danger" },
  ].filter((s) => s.count > 0)

  return (
    <PanelCard
      title="Attendance Overview"
      source="Attendance"
      className={className}
      aside={
        <Link
          href="/attendance"
          className="group inline-flex items-center gap-0.5 text-[11px] font-medium text-primary hover:underline underline-offset-4"
        >
          All records
          <ArrowUpRight
            className="h-3 w-3 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px"
            aria-hidden
          />
        </Link>
      }
    >
      <div className="stagger grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Stat label="Present" value={data.present} tone="text-success" />
        <Stat label="Late" value={data.late} tone="text-warning" />
        <Stat label="Absent" value={data.absent} tone="text-danger" />
        <Stat label="Overtime" value={data.overtimeRecords} tone="text-info" />
      </div>

      {total > 0 && (
        <div className="mt-3">
          <div
            className="flex h-1.5 w-full gap-px overflow-hidden rounded-full bg-surface-muted"
            role="img"
            aria-label={segments.map((s) => `${s.count} ${s.label}`).join(", ")}
          >
            {segments.map((s, i) => (
              <span
                key={s.key}
                className={cn("grow-rail h-full rounded-full", s.fill)}
                style={{ width: `${(s.count / total) * 100}%`, ...delay(i * 90) }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[10px] text-subtle-foreground tabular">
            {total} records · {segments.map((s) => `${s.count} ${s.label}`).join(" · ")}
          </p>
        </div>
      )}

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

export function TimeOffPanel({
  rows,
  className,
}: {
  rows: TimeOffOverviewRow[]
  className?: string
}) {
  const pending = rows.reduce((n, r) => n + r.pending, 0)
  return (
    <PanelCard
      title="Time Off Overview"
      source="Time Off Requests + Allocations"
      className={className}
      aside={
        pending > 0 ? (
          <Link
            href="/time-off/requests?status=TO_APPROVE"
            className="inline-flex items-center gap-1.5 rounded-md bg-warning-subtle px-2 py-0.5 text-[11px] font-medium text-warning ring-1 ring-inset ring-warning/25 transition-colors duration-150 hover:bg-warning-subtle/70"
          >
            <span className="relative flex h-1.5 w-1.5">
              <span
                aria-hidden
                className="absolute inline-flex h-full w-full animate-ping rounded-full bg-warning opacity-70"
              />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-warning" />
            </span>
            <span className="tabular">{pending}</span> awaiting approval
          </Link>
        ) : null
      }
    >
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

export function DepartmentPanel({
  rows,
  className,
}: {
  rows: DepartmentOverviewRow[]
  className?: string
}) {
  const max = rows.reduce((m, r) => Math.max(m, r.monthlySalary), 0)
  return (
    <PanelCard title="Department Overview" source="Employee + Contract" className={className}>
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
          {rows.map((r, i) => (
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
                      className="grow-rail block h-full rounded-full bg-chart-1"
                      style={{
                        width: max > 0 ? `${(r.monthlySalary / max) * 100}%` : 0,
                        ...delay(i * 70),
                      }}
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

const ALERT_DOT = {
  BLOCKING: "bg-danger",
  WARNING: "bg-warning",
  INFO: "bg-info",
} as const

function SeverityChip({
  severity,
  count,
}: {
  severity: keyof typeof ALERT_TONE
  count: number
}) {
  const label = severity === "BLOCKING" ? "blocking" : severity === "WARNING" ? "warnings" : "info"
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
        count > 0 ? ALERT_TONE[severity] : "bg-neutral-subtle text-subtle-foreground ring-neutral/20",
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {severity === "BLOCKING" && count > 0 && (
          <span
            aria-hidden
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger opacity-70"
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            count > 0 ? ALERT_DOT[severity] : "bg-neutral",
          )}
        />
      </span>
      <span className="tabular">{count}</span> {label}
    </span>
  )
}

export function AlertsPanel({
  alerts,
  counts,
  payrunHref,
  className,
}: {
  alerts: AlertRow[]
  /** Grouped totals — the list below is capped, so never count from it. */
  counts: WarningSeverityCounts
  payrunHref: string | null
  className?: string
}) {
  const total = counts.blocking + counts.warning + counts.info
  const hidden = Math.max(0, total - alerts.length)
  return (
    <PanelCard
      title="Payroll Alerts"
      source="Payrun + Payslip validation"
      className={className}
      aside={
        <span className="flex flex-wrap items-center gap-1.5">
          <SeverityChip severity="BLOCKING" count={counts.blocking} />
          <SeverityChip severity="WARNING" count={counts.warning} />
          <SeverityChip severity="INFO" count={counts.info} />
        </span>
      }
    >
      {alerts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border/80 py-6 text-center text-xs text-muted-foreground">
          {payrunHref
            ? "No payroll warnings raised for this period's payrun."
            : "No payrun for this period, so nothing has been validated yet."}
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

      {payrunHref && (hidden > 0 || alerts.length > 0) && (
        <p className="mt-3 text-[11px] text-subtle-foreground">
          {hidden > 0 && <span className="tabular">{hidden} more not shown · </span>}
          <Link
            href={payrunHref}
            className="group inline-flex items-center gap-0.5 font-medium text-primary hover:underline underline-offset-4"
          >
            Open the payrun
            <ArrowUpRight
              className="h-3 w-3 transition-transform duration-150 group-hover:-translate-y-px group-hover:translate-x-px"
              aria-hidden
            />
          </Link>
        </p>
      )}
    </PanelCard>
  )
}
