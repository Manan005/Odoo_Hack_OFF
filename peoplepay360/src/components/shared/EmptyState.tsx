import { Inbox, type LucideIcon } from "lucide-react"

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
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span className="relative flex h-14 w-14 items-center justify-center">
        <span
          aria-hidden
          className="absolute inset-0 -m-3 rounded-full border border-border/60"
        />
        <span
          aria-hidden
          className="absolute inset-0 -m-7 rounded-full border border-border/40"
        />
        <span className="relative flex h-14 w-14 animate-scale-in items-center justify-center rounded-2xl bg-surface-muted text-muted-foreground ring-1 ring-border/70">
          <Icon className="h-6 w-6" aria-hidden />
        </span>
      </span>
      <p className="mt-5 text-[15px] font-semibold tracking-tight">{title}</p>
      {description && (
        <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
          {description}
        </p>
      )}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
