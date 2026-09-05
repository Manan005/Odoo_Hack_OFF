import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const TONE = {
  danger: "bg-danger-subtle text-danger ring-danger/20",
  warning: "bg-warning-subtle text-warning ring-warning/20",
  neutral: "bg-surface-muted text-muted-foreground ring-border/70",
} as const

/**
 * Shared composition for 403 / 404 / error screens: a faint code watermark,
 * an icon tile, one heading, one sentence, actions.
 */
export function StatusPage({
  code,
  icon: Icon,
  tone,
  title,
  message,
  actions,
}: {
  code?: string
  icon: LucideIcon
  tone: keyof typeof TONE
  title: string
  message: string
  actions?: React.ReactNode
}) {
  return (
    <div className="relative flex flex-col items-center justify-center px-6 py-24 text-center">
      {code && (
        <span
          aria-hidden
          className="pointer-events-none absolute top-8 select-none text-[120px] font-semibold leading-none tracking-tighter text-border/60"
        >
          {code}
        </span>
      )}
      <span
        className={cn(
          "relative inline-flex h-14 w-14 animate-scale-in items-center justify-center rounded-2xl ring-1",
          TONE[tone],
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="relative mt-5 text-xl font-semibold tracking-tight">{title}</h1>
      <p className="relative mt-1.5 max-w-md text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      {actions && <div className="relative mt-6 flex items-center gap-2">{actions}</div>}
    </div>
  )
}
