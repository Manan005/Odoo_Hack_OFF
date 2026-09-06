"use client"

import { cn } from "@/lib/utils"

export interface SegmentedOption<T extends string> {
  value: T
  label: React.ReactNode
}

/**
 * Equal-width segmented control with a sliding thumb. Used for view
 * switchers and other 2–4 way choices. The outer thumb springs to the new
 * segment; its inner face remounts per change and lands with a slight
 * squash, so the move reads as a physical object settling.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = "sm",
  ariaLabel,
  className,
}: {
  options: SegmentedOption<T>[]
  value: T
  onChange: (value: T) => void
  size?: "sm" | "md"
  ariaLabel?: string
  className?: string
}) {
  const n = options.length
  const index = Math.max(0, options.findIndex((o) => o.value === value))

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const dir =
      e.key === "ArrowRight" || e.key === "ArrowDown"
        ? 1
        : e.key === "ArrowLeft" || e.key === "ArrowUp"
          ? -1
          : 0
    if (!dir) return
    e.preventDefault()
    const next = (index + dir + n) % n
    onChange(options[next].value)
    e.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]')[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn(
        "relative grid rounded-lg border border-border/70 bg-surface-muted/70 p-0.5",
        className,
      )}
      style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 transition-transform duration-350 ease-spring"
        style={{
          width: `calc((100% - 0.25rem) / ${n})`,
          transform: `translateX(${index * 100}%)`,
        }}
      >
        <span key={index} className="seg-thumb block h-full w-full rounded-md bg-surface shadow-card" />
      </span>
      {options.map((o) => {
        const active = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 inline-flex items-center justify-center whitespace-nowrap rounded-md font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              size === "sm" ? "h-7 px-2.5 text-xs" : "h-8 px-3 text-sm",
              active
                ? "text-foreground"
                : "text-muted-foreground hover:bg-surface-hover/60 hover:text-foreground",
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
