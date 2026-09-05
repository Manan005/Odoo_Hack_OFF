import Link from "next/link"
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
    <div className="mb-5 rounded-lg border border-border bg-surface p-5 shadow-card">
      <Link
        href={backHref}
        className="text-xs text-muted-foreground hover:text-primary"
      >
        ← {breadcrumb}
      </Link>

      <div className="mt-2 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          {avatar && (
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary">
              {avatar}
            </span>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
      </div>

      {smartButtons && (
        <div className="mt-4 border-t border-border pt-3">{smartButtons}</div>
      )}
    </div>
  )
}

export function FormSection({
  title,
  className,
  children,
}: {
  title?: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <section className={cn("rounded-lg border border-border bg-surface p-5 shadow-card", className)}>
      {title && (
        <h2 className="mb-4 border-b border-border pb-2 text-[15px] font-semibold">{title}</h2>
      )}
      {children}
    </section>
  )
}

/** Standard two-column field grid — design.md §4. */
export function FieldGrid({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">{children}</div>
  )
}
