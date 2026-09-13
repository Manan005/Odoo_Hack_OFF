"use client"

import { useState, type CSSProperties, type ReactNode } from "react"
import { cn } from "@/lib/utils"

/**
 * One line of the salary ledger. Hover and keyboard focus reveal the formula
 * peek in CSS; a tap, click, Enter or Space pins it with `data-open`, which is
 * the only way in on a touch screen (a <tr tabIndex=0> is not tap-focusable
 * on iOS). Tiny client leaf so the ledger — whose props carry Prisma
 * Decimals — stays a Server Component.
 */
export function LedgerRow({
  className,
  style,
  children,
}: {
  className?: string
  style?: CSSProperties
  children: ReactNode
}) {
  const [open, setOpen] = useState(false)
  const toggle = () => setOpen((v) => !v)

  return (
    <tr
      tabIndex={0}
      aria-expanded={open}
      data-open={open || undefined}
      className={cn("ledger-row cursor-pointer", className)}
      style={style}
      onClick={toggle}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return
        e.preventDefault()
        toggle()
      }}
    >
      {children}
    </tr>
  )
}
