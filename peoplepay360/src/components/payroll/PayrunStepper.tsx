import { PayrunStatus } from "@prisma/client"
import { Check } from "lucide-react"
import { cn } from "@/lib/utils"

const STEPS = ["Draft", "Computed", "Validated", "Paid", "Sent"] as const

const INDEX: Record<PayrunStatus, number> = {
  DRAFT: 0,
  COMPUTED: 1,
  VALIDATED: 2,
  PAID: 3,
}

/**
 * The payrun state machine as a progress rail. Purely presentational — the
 * transitions themselves are enforced server-side in payrun-service.
 */
export function PayrunStepper({
  status,
  allSent,
  className,
}: {
  status: PayrunStatus
  /** Every payslip in the run has been emailed. */
  allSent: boolean
  className?: string
}) {
  const current = status === PayrunStatus.PAID && allSent ? 4 : INDEX[status]
  const progress = current / (STEPS.length - 1)

  return (
    <ol className={cn("relative flex items-start justify-between", className)} aria-label="Payrun progress">
      <span
        aria-hidden
        className="absolute left-[10px] right-[10px] top-[9px] h-0.5 rounded-full bg-border/80"
      />
      <span
        aria-hidden
        className="absolute left-[10px] top-[9px] h-0.5 origin-left animate-rail rounded-full bg-primary"
        style={{ width: `calc((100% - 20px) * ${progress})` }}
      />
      {STEPS.map((label, i) => {
        const done = i < current
        const active = i === current
        return (
          <li
            key={label}
            className="relative flex flex-col items-center gap-2 text-center"
            aria-current={active ? "step" : undefined}
          >
            <span
              className={cn(
                "relative flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-surface transition-colors duration-300",
                done && "bg-primary text-primary-fg",
                active && "bg-surface text-primary shadow-[inset_0_0_0_2px_var(--color-primary)]",
                !done && !active && "bg-surface shadow-[inset_0_0_0_2px_var(--color-border)]",
              )}
            >
              {done && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
              {active && (
                <>
                  <span
                    aria-hidden
                    className="absolute inline-flex h-2 w-2 animate-ping rounded-full bg-primary opacity-60"
                  />
                  <span className="relative h-2 w-2 rounded-full bg-primary" />
                </>
              )}
            </span>
            <span
              className={cn(
                "text-[11px] font-medium",
                active ? "text-primary" : done ? "text-foreground" : "text-subtle-foreground",
              )}
            >
              {label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}
