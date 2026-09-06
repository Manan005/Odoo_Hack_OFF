import type { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

const TONE = {
  danger: "bg-danger-subtle text-danger ring-danger/20",
  warning: "bg-warning-subtle text-warning ring-warning/20",
  neutral: "bg-surface-muted text-muted-foreground ring-border/70",
} as const

/**
 * Shared composition for 403 / 404 / error screens: a hollow display-serif
 * code watermark over the three brand stripes, an icon tile, one heading,
 * one sentence, actions, and an optional footer (suggested destinations,
 * error reference).
 */
export function StatusPage({
  code,
  icon: Icon,
  tone,
  title,
  message,
  actions,
  footer,
}: {
  code?: string
  icon: LucideIcon
  tone: keyof typeof TONE
  title: string
  message: string
  actions?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="relative flex flex-col items-center justify-center overflow-hidden px-6 py-24 text-center">
      <span
        aria-hidden
        className="status-stripes pointer-events-none absolute left-1/2 top-2 h-56 -translate-x-1/2 select-none"
      >
        <span className="h-32 bg-chart-1" />
        <span className="h-56 bg-chart-5" />
        <span className="h-44 bg-chart-4" />
      </span>
      {code && (
        <span
          aria-hidden
          className="status-code pointer-events-none absolute top-4 select-none animate-fade-in"
        >
          {code}
        </span>
      )}

      <span
        className={cn(
          "relative inline-flex h-14 w-14 animate-scale-in items-center justify-center rounded-2xl shadow-card ring-1",
          TONE[tone],
        )}
      >
        <Icon className="h-6 w-6" aria-hidden />
      </span>
      <h1 className="relative mt-6 font-display text-[28px] font-medium leading-[1.15] tracking-[-0.015em]">
        {title}
      </h1>
      <p className="relative mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
        {message}
      </p>
      {actions && (
        <div className="relative mt-7 flex flex-wrap items-center justify-center gap-2">{actions}</div>
      )}
      {footer && <div className="relative mt-10 w-full max-w-lg">{footer}</div>}
    </div>
  )
}
