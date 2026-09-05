import { WarningSeverity } from "@prisma/client"
import { CheckCircle2, Info, ShieldAlert, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface PayrollWarningRow {
  id: string
  code: string
  severity: WarningSeverity
  message: string
  payslipId: string | null
}

const ICON = {
  BLOCKING: ShieldAlert,
  WARNING: TriangleAlert,
  INFO: Info,
} as const

const TONE = {
  BLOCKING: "border-l-2 border-danger bg-danger-subtle text-danger",
  WARNING: "text-warning",
  INFO: "text-info",
} as const

const RANK = { BLOCKING: 0, WARNING: 1, INFO: 2 } as const

export function WarningsPanel({ warnings }: { warnings: PayrollWarningRow[] }) {
  if (warnings.length === 0) {
    return (
      <section className="mb-5 rounded-lg border border-border bg-surface p-4 shadow-card">
        <p className="flex items-center gap-2 text-sm text-success">
          <CheckCircle2 className="h-4 w-4" />
          No payroll warnings.
        </p>
      </section>
    )
  }

  const sorted = [...warnings].sort((a, b) => RANK[a.severity] - RANK[b.severity])
  const blocking = warnings.filter((w) => w.severity === WarningSeverity.BLOCKING).length

  return (
    <section className="mb-5 rounded-lg border border-border bg-surface p-4 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
        Warnings ({warnings.length})
        {blocking > 0 && (
          <span className="rounded-md bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger">
            {blocking} blocking validation
          </span>
        )}
      </h2>

      <ul className="space-y-1.5">
        {sorted.map((w) => {
          const Icon = ICON[w.severity]
          return (
            <li
              key={w.id}
              className={cn(
                "flex items-start gap-2 rounded-md px-3 py-2 text-xs",
                TONE[w.severity],
              )}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span className="flex-1">{w.message}</span>
              {w.payslipId && (
                <Link
                  href={`/payroll/payslips/${w.payslipId}`}
                  className="shrink-0 font-medium hover:underline"
                >
                  View →
                </Link>
              )}
            </li>
          )
        })}
      </ul>
    </section>
  )
}
