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
    <Surface padded className="mb-5">
      <Link
        href={backHref}
        className="group inline-flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
      >
        <ChevronLeft
          className="h-3.5 w-3.5 transition-transform duration-200 ease-out-quart group-hover:-translate-x-0.5"
          aria-hidden
        />
        {breadcrumb}
      </Link>

      <div className="mt-3 flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          {avatar && (
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-sm font-semibold text-primary ring-1 ring-primary/15">
              {avatar}
            </span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
              {badge}
            </div>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
          </div>
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
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
