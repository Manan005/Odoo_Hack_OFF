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
    <div className="flex flex-wrap gap-2">
      {buttons.map(({ label, count, href, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm transition-colors",
            "hover:border-primary hover:text-primary",
            count === 0 && "text-muted-foreground",
          )}
        >
          <Icon className="h-4 w-4" />
          {label}
          <span className="rounded bg-surface-muted px-1.5 text-xs font-semibold tabular">
            {count}
          </span>
        </Link>
      ))}
    </div>
  )
}
