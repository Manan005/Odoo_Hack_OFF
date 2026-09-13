import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Surface } from "@/components/ui/surface"
import { cn } from "@/lib/utils"

export function FormHeader({
  breadcrumb,
  backHref,
  title,
  subtitle,
  avatar,
  badge,
  actions,
  smartButtons,
}: {
  breadcrumb: string
  backHref: string
  title: string
  subtitle?: string
  avatar?: string
  badge?: React.ReactNode
  actions?: React.ReactNode
  smartButtons?: React.ReactNode
}) {
  return (
    <Surface padded tone="raised" className="mb-5">
      <Link
        href={backHref}
        className="group inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft
          className="h-3.5 w-3.5 shrink-0 transition-transform duration-200 ease-out-quart group-hover:-translate-x-0.5"
          aria-hidden
        />
        <span className="truncate">{breadcrumb}</span>
      </Link>

      {/*
       * Phone: the title block takes the full row and the actions drop under it
       * as a full-width bar; each action grows to share the width and clears a
       * 40px hit box. From `sm` up they sit on the right at their natural size.
       */}
      <div className="mt-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-3">
        <div className="flex min-w-0 flex-1 basis-60 items-center gap-3 sm:gap-3.5">
          {avatar && (
            <span
              aria-hidden
              className={cn(
                "flex h-10 w-10 shrink-0 animate-scale-in items-center justify-center rounded-xl sm:h-12 sm:w-12",
                "bg-linear-to-br from-primary to-chart-2 text-sm font-semibold text-primary-fg",
                "shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--color-primary-fg)_28%,transparent)] ring-1 ring-primary/20",
              )}
            >
              {avatar}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="min-w-0 font-display text-xl font-semibold leading-tight tracking-[-0.02em] [overflow-wrap:anywhere] sm:text-2xl">
                {title}
              </h1>
              {badge}
            </div>
            {subtitle && (
              <p className="mt-0.5 text-[13px] text-muted-foreground [overflow-wrap:anywhere]">
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {actions && (
          <div className="flex w-full flex-wrap items-center gap-2 *:min-h-10 *:flex-1 sm:w-auto sm:shrink-0 sm:*:min-h-0 sm:*:flex-none">
            {actions}
          </div>
        )}
      </div>

      {smartButtons && <div className="mt-5 border-t border-border/70 pt-4">{smartButtons}</div>}
    </Surface>
  )
}

export function FormSection({
  title,
  description,
  className,
  children,
}: {
  title?: string
  description?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <Surface as="section" padded className={cn(className)}>
      {title && (
        <div className="mb-5 border-b border-border/70 pb-3">
          <h2 className="text-[15px] font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
      )}
      {children}
    </Surface>
  )
}

/** Standard two-column field grid — design.md §4. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-x-8 gap-y-5 md:grid-cols-2">{children}</div>
}

/**
 * Footer for a form's Save / Cancel pair. On a phone the buttons stack as
 * full-width, 40px-tall controls (primary first, as the DOM order has it);
 * from `sm` up they sit inline at their natural size.
 */
export function FormActions({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 *:min-h-10 *:w-full sm:flex-row sm:items-center sm:*:min-h-0 sm:*:w-auto",
        className,
      )}
    >
      {children}
    </div>
  )
}
