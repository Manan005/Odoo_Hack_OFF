import { Inbox, type LucideIcon } from "lucide-react"

/**
 * One parametric illustration for every empty list: a ledger sheet that
 * draws itself — the sheet outline, three ruled lines, a dashed seal where a
 * stamp would go — with the module's icon sitting on it. Line-art in
 * `currentColor`, so it is right in both themes without a second asset.
 */
function LedgerSheet() {
  return (
    <svg
      viewBox="0 0 120 100"
      className="absolute inset-0 h-full w-full text-border-strong"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.25"
      aria-hidden
    >
      <g transform="rotate(-4 60 50)">
        <rect data-draw="" x="22" y="4" width="76" height="92" rx="10" pathLength={1} />
        <line
          data-draw=""
          x1="36"
          y1="62"
          x2="84"
          y2="62"
          pathLength={1}
          opacity="0.7"
          style={{ ["--d" as string]: "350ms" }}
        />
        <line
          data-draw=""
          x1="36"
          y1="72"
          x2="68"
          y2="72"
          pathLength={1}
          opacity="0.7"
          style={{ ["--d" as string]: "450ms" }}
        />
        <line
          data-draw=""
          x1="36"
          y1="82"
          x2="58"
          y2="82"
          pathLength={1}
          opacity="0.7"
          style={{ ["--d" as string]: "550ms" }}
        />
        <circle
          data-dash=""
          cx="82"
          cy="78"
          r="9"
          pathLength={1}
          strokeDasharray="0.08 0.06"
          strokeLinecap="round"
          className="text-primary/70"
        />
      </g>
    </svg>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      <span className="ledger-draw relative block h-[100px] w-[120px]">
        <LedgerSheet />
        <span className="absolute left-1/2 top-4 flex h-10 w-10 -translate-x-1/2 animate-scale-in items-center justify-center rounded-xl bg-surface-muted text-muted-foreground ring-1 ring-border/70 [animation-delay:420ms]">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </span>
      <p className="mt-4 font-display text-lg font-medium tracking-tight">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
