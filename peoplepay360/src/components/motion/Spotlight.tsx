"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Cursor-tracking glow. The element gets `--mx` / `--my` (pixels, relative to
 * its own box) on pointermove; the `.spot` class in globals.css paints a
 * radial highlight at that point. One listener per element, writes only to
 * custom properties, so nothing re-renders and nothing re-lays out.
 *
 *   <Spotlight className="relative overflow-hidden rounded-2xl">…</Spotlight>
 */
export function Spotlight({
  as: Tag = "div",
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li" }) {
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
    el.style.setProperty("--my", `${e.clientY - rect.top}px`)
  }
  return (
    <Tag className={cn("spot", className)} onPointerMove={onPointerMove} {...props}>
      {children}
    </Tag>
  )
}

/**
 * Pointer-tilt. Writes `--rx` / `--ry` (degrees) from the pointer's offset
 * from the element centre; the `.tilt` class applies the perspective
 * transform and eases it back on leave. Max tilt defaults to 6°.
 *
 *   <Tilt className="rounded-2xl">…</Tilt>
 */
export function Tilt({
  as: Tag = "div",
  max = 6,
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLElement> & { as?: "div" | "section" | "article" | "li"; max?: number }) {
  const onPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    const rect = el.getBoundingClientRect()
    const px = (e.clientX - rect.left) / rect.width - 0.5
    const py = (e.clientY - rect.top) / rect.height - 0.5
    el.style.setProperty("--ry", `${(px * max * 2).toFixed(2)}deg`)
    el.style.setProperty("--rx", `${(-py * max * 2).toFixed(2)}deg`)
    el.style.setProperty("--mx", `${e.clientX - rect.left}px`)
    el.style.setProperty("--my", `${e.clientY - rect.top}px`)
  }
  const onPointerLeave = (e: React.PointerEvent<HTMLElement>) => {
    const el = e.currentTarget
    el.style.setProperty("--rx", "0deg")
    el.style.setProperty("--ry", "0deg")
  }
  return (
    <Tag
      className={cn("tilt spot", className)}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      {...props}
    >
      {children}
    </Tag>
  )
}
