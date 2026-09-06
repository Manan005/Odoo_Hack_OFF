import { cn } from "@/lib/utils"

/**
 * Page title in the display register: a serif at 30px rising out of a
 * clipped line box, an eyebrow with a short rail drawing before it, the
 * subtitle settling in after, actions cascading on the right. Once per
 * page, so it may take its 500 ms (ui-redesign.md §2.4).
 */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
  className,
}: {
  /** Small caps section label above the title, e.g. "Payroll". */
  eyebrow?: string
  title: string
  subtitle?: string
  actions?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("mb-5 flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {eyebrow && (
          <p className="mb-1.5 flex animate-fade-in items-center text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
            <span aria-hidden className="eyebrow-rail" />
            {eyebrow}
          </p>
        )}
        {/* The wrapper clips; a little bottom room keeps serif descenders whole. */}
        <div className="-mb-1 overflow-hidden pb-1">
          <h1 className="rise-in font-display text-[30px] font-medium leading-[1.1] tracking-[-0.02em]">
            {title}
          </h1>
        </div>
        {subtitle && (
          <p className="mt-1.5 animate-fade-in text-[13px] text-muted-foreground [animation-delay:180ms]">
            {subtitle}
          </p>
        )}
      </div>
      {actions && (
        <div className="stagger flex shrink-0 items-center gap-2 [--stagger-offset:2]">
          {actions}
        </div>
      )}
    </div>
  )
}
