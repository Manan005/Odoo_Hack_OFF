import { cn } from "@/lib/utils"

type Tone = "success" | "warning" | "danger" | "info" | "primary" | "neutral"

/*
 * Success and danger carry a soft outer glow — the two states a reviewer is
 * scanning a list for. `--glow` feeds the arbitrary shadow so the ring
 * (also a box-shadow layer) composes with it instead of being replaced.
 */
const TONE: Record<Tone, string> = {
  success:
    "bg-success-subtle text-success ring-success/20 shadow-[0_0_10px_-2px_var(--glow)] [--glow:color-mix(in_oklch,var(--color-success)_45%,transparent)]",
  warning: "bg-warning-subtle text-warning ring-warning/25",
  danger:
    "bg-danger-subtle text-danger ring-danger/20 shadow-[0_0_10px_-2px_var(--glow)] [--glow:color-mix(in_oklch,var(--color-danger)_45%,transparent)]",
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
  stamp,
}: {
  status: string | null | undefined
  className?: string
  /**
   * Record-header use only (never table cells): the badge is keyed by status
   * and lands like an ink stamp each time the state machine advances —
   * Draft → Computed → Validated → Paid gets a visual event.
   */
  stamp?: boolean
}) {
  if (!status) return <span className="text-muted-foreground">—</span>
  const entry = MAP[status] ?? { tone: "neutral" as Tone, label: status }

  return (
    <span
      key={stamp ? status : undefined}
      title={`Status: ${entry.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset",
        TONE[entry.tone],
        stamp && "badge-stamp",
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
