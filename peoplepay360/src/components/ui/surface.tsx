import * as React from "react"
import { cn } from "@/lib/utils"

type SurfaceTag = "div" | "section" | "article" | "aside" | "header" | "footer"

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: SurfaceTag
  /** Standard 20px inner padding. */
  padded?: boolean
  /** Lifts on hover — for cards that are links or open something. */
  interactive?: boolean
}

/**
 * The one card shell. Hairline border, tinted shadow, container radius.
 * Every panel, form section and table wrapper is a Surface so the whole app
 * shares a single notion of "a thing sitting on the page".
 */
export function Surface({
  as: Tag = "div",
  padded,
  interactive,
  className,
  ...props
}: SurfaceProps) {
  return (
    <Tag
      className={cn(
        "rounded-2xl border border-border/70 bg-surface shadow-card",
        padded && "p-5",
        interactive &&
          "transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise",
        className,
      )}
      {...props}
    />
  )
}
