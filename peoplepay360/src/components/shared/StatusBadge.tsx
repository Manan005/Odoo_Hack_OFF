import { cn } from "@/lib/utils"

type Tone = "success" | "warning" | "danger" | "info" | "primary" | "neutral"

const TONE: Record<Tone, string> = {
  success: "bg-success-subtle text-success ring-success/20",
  warning: "bg-warning-subtle text-warning ring-warning/25",
  danger: "bg-danger-subtle text-danger ring-danger/20",
  info: "bg-info-subtle text-info ring-info/20",
  primary: "bg-primary-subtle text-primary ring-primary/20",
  neutral: "bg-neutral-subtle text-neutral ring-neutral/20",
}

const DOT: Record<Tone, string> = {
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  primary: "bg-primary",
  neutral: "bg-neutral",
}

/**
 * Single source of truth for status colour — design.md §5.
 * Never build an ad-hoc coloured span; add the enum value here instead.
 * `live` marks states that are waiting on a person — the dot pulses.
 */
const MAP: Record<string, { tone: Tone; label: string; hollow?: boolean; live?: boolean }> = {
  // ContractStatus
  DRAFT: { tone: "neutral", label: "Draft", hollow: true },
  RUNNING: { tone: "success", label: "Running" },
  EXPIRED: { tone: "neutral", label: "Expired" },
  CANCELLED: { tone: "danger", label: "Cancelled" },

  // AttendanceStatus
  PRESENT: { tone: "success", label: "Present" },
  LATE: { tone: "warning", label: "Late" },
  ABSENT: { tone: "danger", label: "Absent" },
  HALF_DAY: { tone: "info", label: "Half Day" },

  // RequestStatus (requests + allocations)
  TO_APPROVE: { tone: "warning", label: "To Approve", live: true },
  APPROVED: { tone: "success", label: "Approved" },
  REFUSED: { tone: "danger", label: "Refused" },

  // Payrun / Payslip
  COMPUTED: { tone: "info", label: "Computed" },
  VALIDATED: { tone: "primary", label: "Validated" },
  PAID: { tone: "success", label: "Paid" },

  // WarningSeverity
  INFO: { tone: "info", label: "Info" },
  WARNING: { tone: "warning", label: "Warning" },
  BLOCKING: { tone: "danger", label: "Blocking" },

  // Generic active flag
  ACTIVE: { tone: "success", label: "Active" },
  INACTIVE: { tone: "neutral", label: "Inactive" },
}

export function StatusBadge({
  status,
  className,
}: {
  status: string | null | undefined
  className?: string
}) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const entry = MAP[status] ?? { tone: "neutral" as Tone, label: status }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[entry.tone],
        className,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {entry.live && (
          <span
            aria-hidden
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-70",
              DOT[entry.tone],
            )}
          />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            entry.hollow ? "border border-current bg-transparent" : DOT[entry.tone],
          )}
        />
      </span>
      {entry.label}
    </span>
  )
}

/** Boolean `active` columns render the same way as an enum. */
export function ActiveBadge({ active }: { active: boolean }) {
  return <StatusBadge status={active ? "ACTIVE" : "INACTIVE"} />
}
