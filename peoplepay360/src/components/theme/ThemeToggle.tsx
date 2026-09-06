"use client"

import { Monitor, Moon, Sun } from "lucide-react"
import { useTheme, type Theme, type ThemeOrigin } from "@/components/theme/ThemeProvider"
import { cn } from "@/lib/utils"

/** Centre of the control that was activated — works for keyboard too. */
const originOf = (el: HTMLElement): ThemeOrigin => {
  const r = el.getBoundingClientRect()
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
}

/**
 * One-click light/dark flip. The icons morph with CSS keyed off
 * `[data-theme]`, so the markup is identical on server and client and there
 * is nothing to hydrate wrongly. The new theme is revealed in a circle that
 * grows from this button.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setTheme } = useTheme()
  return (
    <button
      type="button"
      aria-label="Toggle dark mode"
      aria-pressed={resolved === "dark"}
      onClick={(e) => setTheme(resolved === "dark" ? "light" : "dark", originOf(e.currentTarget))}
      className={cn(
        "relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground",
        "transition-[background-color,color,transform,scale] duration-150 ease-out-quart",
        "hover:bg-surface-hover hover:text-foreground active:scale-95",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
    >
      <Sun
        className="h-4 w-4 rotate-0 scale-100 transition-[transform,rotate,scale,opacity] duration-300 ease-spring dark:-rotate-90 dark:scale-0 dark:opacity-0"
        aria-hidden
      />
      <Moon
        className="absolute h-4 w-4 rotate-90 scale-0 opacity-0 transition-[transform,rotate,scale,opacity] duration-300 ease-spring dark:rotate-0 dark:scale-100 dark:opacity-100"
        aria-hidden
      />
    </button>
  )
}

const OPTIONS: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "Auto", icon: Monitor },
]

/** Three-way appearance control for the user menu. */
export function AppearanceSegment() {
  const { theme, setTheme } = useTheme()
  const index = Math.max(0, OPTIONS.findIndex((o) => o.value === theme))

  return (
    <div
      role="radiogroup"
      aria-label="Appearance"
      className="relative grid grid-cols-3 rounded-lg bg-surface-muted p-0.5"
    >
      <span
        aria-hidden
        className="absolute inset-y-0.5 left-0.5 w-[calc((100%-0.25rem)/3)] rounded-md bg-surface shadow-card transition-transform duration-300 ease-out-quart"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={(e) => setTheme(value, originOf(e.currentTarget))}
            className={cn(
              "relative z-10 inline-flex h-7 items-center justify-center gap-1.5 rounded-md text-xs font-medium transition-colors duration-150",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        )
      })}
    </div>
  )
}
