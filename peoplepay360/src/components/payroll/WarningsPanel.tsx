import { WarningSeverity } from "@prisma/client"
import { ArrowUpRight, CheckCircle2, Info, ShieldAlert, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { Surface } from "@/components/ui/surface"
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
  BLOCKING: "warn-blocking bg-danger-subtle text-danger ring-danger/25",
  WARNING: "warn-warning bg-warning-subtle/60 text-warning ring-warning/20",
  INFO: "warn-info bg-info-subtle/60 text-info ring-info/20",
} as const

const RANK = { BLOCKING: 0, WARNING: 1, INFO: 2 } as const

/**
 * Warnings sorted blocking-first, each with a severity rail on its left edge.
 * Blocking rows pulse once on entrance — they are the reason Validate is
 * disabled, so they should announce themselves.
 */
export function WarningsPanel({ warnings }: { warnings: PayrollWarningRow[] }) {
  if (warnings.length === 0) {
    return (
      <Surface className="mb-5 flex items-center gap-3 px-5 py-3.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-subtle text-success ring-1 ring-inset ring-success/20">
          <CheckCircle2 className="h-4 w-4" aria-hidden />
        </span>
        <p className="text-sm">
          <span className="font-medium">No payroll warnings.</span>{" "}
          <span className="text-muted-foreground">Every payslip has a contract and bank details.</span>
        </p>
      </Surface>
    )
  }

  const sorted = [...warnings].sort((a, b) => RANK[a.severity] - RANK[b.severity])
  const blocking = warnings.filter((w) => w.severity === WarningSeverity.BLOCKING).length

  return (
    <Surface as="section" padded className="mb-5">
      <h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold tracking-tight">
        Warnings
        <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-semibold tabular text-muted-foreground">
          {warnings.length}
        </span>
        {blocking > 0 && (
          <span className="rounded-md bg-danger-subtle px-2 py-0.5 text-xs font-medium text-danger ring-1 ring-inset ring-danger/20">
            {blocking} blocking validation
          </span>
        )}
      </h2>

      <ul className="stagger-rows space-y-1.5">
        {sorted.map((w) => {
          const Icon = ICON[w.severity]
          return (
            <li
              key={w.id}
              className={cn(
                "warn-row flex items-start gap-2.5 rounded-lg py-2 pl-4 pr-3 text-xs ring-1 ring-inset shadow-[inset_3px_0_0_0_var(--warn-tone)]",
                TONE[w.severity],
              )}
            >
              <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="flex-1 text-foreground/90">
                {w.message}
                <span className="ml-2 font-mono text-[10.5px] uppercase tracking-wide text-subtle-foreground">
                  {w.code}
                </span>
              </span>
              {w.payslipId && (
                <Link
                  href={`/payroll/payslips/${w.payslipId}`}
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
    </Surface>
  )
}
