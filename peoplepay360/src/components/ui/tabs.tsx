"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Underline tabs whose indicator measures the active tab and slides to it —
 * a layout animation without any library. The indicator is a 1px-wide bar
 * moved with `translateX` and stretched with `scaleX`, so the spring settle
 * runs entirely on the compositor.
 *
 * Wrap each panel in `.tab-panel` (keyed by tab) for a 200 ms crossfade.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  badges,
  className,
}: {
  tabs: readonly T[]
  value: T
  onChange: (tab: T) => void
  /** Per-tab counts, e.g. validation errors hiding behind an inactive tab. */
  badges?: Partial<Record<T, number>>
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    // ResizeObserver delivers an initial callback after observe(), so the
    // measurement (and the state write) never happens synchronously here.
    const ro = new ResizeObserver(() => {
      const el = list.querySelector<HTMLElement>('[data-active="true"]')
      if (!el) return
      const listRect = list.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      setPos({ left: rect.left - listRect.left + list.scrollLeft, width: rect.width })
    })
    ro.observe(list)
    return () => ro.disconnect()
  }, [value])

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const i = tabs.indexOf(value)
    let next: number | null = null
    if (e.key === "ArrowRight") next = (i + 1) % tabs.length
    else if (e.key === "ArrowLeft") next = (i - 1 + tabs.length) % tabs.length
    else if (e.key === "Home") next = 0
    else if (e.key === "End") next = tabs.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(tabs[next])
    listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div
      ref={listRef}
      role="tablist"
      onKeyDown={onKeyDown}
      className={cn("relative flex gap-1 border-b border-border/70", className)}
    >
      {tabs.map((t) => {
        const active = t === value
        const badge = badges?.[t]
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            data-active={active}
            onClick={() => onChange(t)}
            className={cn(
              "relative -mb-px inline-flex items-center rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
            {badge ? (
              <span
                aria-label={`${badge} ${badge === 1 ? "issue" : "issues"}`}
                className="ml-1.5 inline-flex h-4 min-w-4 animate-scale-in items-center justify-center rounded-full bg-danger px-1 text-[10px] font-semibold tabular text-primary-fg"
              >
                {badge}
              </span>
            ) : null}
          </button>
        )
      })}
      <span
        aria-hidden
        className="absolute -bottom-px left-0 h-0.5 w-px origin-left rounded-full bg-primary transition-[transform,opacity] duration-350 ease-spring"
        style={{
          transform: `translateX(${pos?.left ?? 0}px) scaleX(${pos?.width ?? 0})`,
          opacity: pos ? 1 : 0,
        }}
      />
    </div>
  )
}
