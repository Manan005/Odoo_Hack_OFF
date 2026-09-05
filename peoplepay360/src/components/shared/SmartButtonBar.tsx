import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { cn } from "@/lib/utils"

export interface SmartButton {
  label: string
  count: number
  href: string
  icon: LucideIcon
}

/**
 * Counts are live database queries, never hardcoded (AC-M1-2). Each button
 * opens the related list already filtered to this record (AC-M1-3).
 */
export function SmartButtonBar({ buttons }: { buttons: SmartButton[] }) {
  return (
    <div className="stagger flex flex-wrap gap-2">
      {buttons.map(({ label, count, href, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "group inline-flex items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm",
            "transition-[transform,box-shadow,border-color,color] duration-200 ease-out-quart",
            "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raise active:translate-y-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            count === 0 && "text-muted-foreground",
          )}
        >
          <Icon
            className="h-4 w-4 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
            aria-hidden
          />
          {label}
          <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-semibold tabular transition-colors duration-150 group-hover:bg-primary-subtle group-hover:text-primary">
            {count}
          </span>
        </Link>
      ))}
    </div>
  )
}
