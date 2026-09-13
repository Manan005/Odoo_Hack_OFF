import type { LucideIcon } from "lucide-react"
import Link from "next/link"
import { NumberTicker } from "@/components/ui/number-ticker"
import { cn } from "@/lib/utils"

export interface SmartButton {
  label: string
  count: number
  href: string
  icon: LucideIcon
}

/**
 * Counts are live database queries, never hardcoded (AC-M1-2) — so they roll
 * in like every other real number in the app. Each button opens the related
 * list already filtered to this record (AC-M1-3).
 */
export function SmartButtonBar({ buttons }: { buttons: SmartButton[] }) {
  return (
    // Phone: a two-up grid so every button gets a full 40px row with the count
    // pinned to its right edge; from `sm` up the buttons flow at their own size.
    <div className="stagger grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {buttons.map(({ label, count, href, icon: Icon }) => (
        <Link
          key={label}
          href={href}
          className={cn(
            "group flex min-h-10 min-w-0 items-center gap-2 rounded-xl border border-border/70 bg-surface px-3 py-2 text-sm sm:inline-flex sm:min-h-0",
            "transition-[translate,box-shadow,border-color,color] duration-200 ease-out-quart",
            "hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-raise active:translate-y-0",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
            count === 0 && "text-muted-foreground",
          )}
        >
          <Icon
            className="h-4 w-4 shrink-0 text-muted-foreground transition-colors duration-150 group-hover:text-primary"
            aria-hidden
          />
          <span className="min-w-0 truncate">{label}</span>
          <span className="ml-auto shrink-0 rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-semibold transition-colors duration-150 group-hover:bg-primary-subtle group-hover:text-primary sm:ml-0">
            <NumberTicker value={String(count)} delayStep={60} />
          </span>
        </Link>
      ))}
    </div>
  )
}
