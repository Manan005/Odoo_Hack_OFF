"use client"

import { useLayoutEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

/**
 * Underline tabs whose indicator measures the active tab and slides to it —
 * a layout animation without any library.
 */
export function UnderlineTabs<T extends string>({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: readonly T[]
  value: T
  onChange: (tab: T) => void
  className?: string
}) {
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<{ left: number; width: number } | null>(null)

  useLayoutEffect(() => {
    const list = listRef.current
    if (!list) return
    const measure = () => {
      const el = list.querySelector<HTMLElement>('[data-active="true"]')
      if (!el) return
      const listRect = list.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      setPos({ left: rect.left - listRect.left + list.scrollLeft, width: rect.width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(list)
    return () => ro.disconnect()
  }, [value])

  return (
    <div
      ref={listRef}
      role="tablist"
      className={cn("relative flex gap-1 border-b border-border/70", className)}
    >
      {tabs.map((t) => {
        const active = t === value
        return (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={active}
            data-active={active}
            onClick={() => onChange(t)}
            className={cn(
              "relative -mb-px rounded-t-lg px-3.5 py-2.5 text-sm font-medium transition-colors duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        )
      })}
      <span
        aria-hidden
        className="absolute -bottom-px h-0.5 rounded-full bg-primary transition-[left,width,opacity] duration-300 ease-out-quart"
        style={{ left: pos?.left ?? 0, width: pos?.width ?? 0, opacity: pos ? 1 : 0 }}
      />
    </div>
  )
}
