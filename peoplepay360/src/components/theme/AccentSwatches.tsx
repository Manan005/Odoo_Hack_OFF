"use client"

import { Check } from "lucide-react"
import { useTheme } from "@/components/theme/ThemeProvider"
import { ACCENTS } from "@/lib/theme"
import { cn } from "@/lib/utils"

/**
 * Accent-hue picker for the user menu. Each swatch is painted with the same
 * oklch recipe the primary token uses, so what you click is what you get.
 */
export function AccentSwatches({ className }: { className?: string }) {
  const { accent, setAccent } = useTheme()
  return (
    <div role="radiogroup" aria-label="Accent colour" className={cn("flex items-center gap-1.5", className)}>
      {ACCENTS.map((a) => {
        const active = a.id === accent
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={a.label}
            title={a.label}
            onClick={() => setAccent(a.id)}
            style={{ ["--swatch-h" as string]: String(a.hue) }}
            className={cn(
              "swatch relative inline-flex h-6 w-6 items-center justify-center rounded-full",
              "transition-transform duration-200 ease-spring hover:scale-110 active:scale-95",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
              active ? "ring-2 ring-foreground/80 ring-offset-2 ring-offset-surface" : "",
            )}
          >
            <Check
              className={cn(
                "h-3 w-3 text-white transition-[transform,opacity] duration-200 ease-spring",
                active ? "scale-100 opacity-100" : "scale-50 opacity-0",
              )}
              aria-hidden
            />
          </button>
        )
      })}
    </div>
  )
}
