"use client"

import { Check, Copy } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"

/**
 * A mono chip with a copy button whose icon morphs Copy → Check for 1.2s.
 * Tiny client leaf so the surrounding card or table row stays a Server
 * Component.
 */
export function CopyChip({
  text,
  label = "expression",
  className,
}: {
  text: string
  label?: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const copy = async (e: React.MouseEvent) => {
    // Chips sit inside link rows and cards — never let the click navigate.
    e.preventDefault()
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setCopied(false), 1200)
    } catch (error) {
      console.error("[copy-chip] clipboard write failed:", error)
      toast.error("Clipboard is not available here.")
    }
  }

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md bg-surface-muted pl-2 pr-0.5 font-mono text-[12px] text-foreground/85 ring-1 ring-inset ring-border/70",
        className,
      )}
    >
      <span className="truncate py-0.5">{text}</span>
      <button
        type="button"
        onClick={copy}
        aria-label={copied ? "Copied" : `Copy ${label}`}
        title={copied ? "Copied" : `Copy ${label}`}
        className="rounded p-1 text-muted-foreground transition-[background-color,color,transform] duration-100 hover:bg-surface-hover hover:text-foreground active:scale-90"
      >
        {copied ? (
          <Check className="copy-check h-3 w-3 text-success" aria-hidden />
        ) : (
          <Copy className="h-3 w-3" aria-hidden />
        )}
      </button>
    </span>
  )
}
