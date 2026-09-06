import * as React from "react"
import { Spotlight } from "@/components/motion/Spotlight"
import { cn } from "@/lib/utils"

type SurfaceTag = "div" | "section" | "article" | "aside" | "header" | "footer"
type SurfaceTone = "default" | "muted" | "raised" | "ink"

export interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  as?: SurfaceTag
  /** Standard 20px inner padding. */
  padded?: boolean
  /** Lifts on hover — for cards that are links or open something. */
  interactive?: boolean
  /**
   * A radial primary glow follows the cursor across the card (via the
   * `Spotlight` client leaf — the Surface itself stays a Server Component).
   */
  spotlight?: boolean
  /**
   * `raised` sits above its neighbours (record headers); `muted` recedes;
   * `ink` is the brand's near-black with a lighter 1px top edge, for one
   * hero panel per page at most.
   */
  tone?: SurfaceTone
}

const TONE: Record<SurfaceTone, string> = {
  default: "border-border/70 bg-surface shadow-card",
  muted: "border-border/60 bg-surface-muted/60 shadow-none",
  raised: "border-border/70 bg-surface-raised shadow-raise",
  ink:
    "border-ink-fg/10 bg-ink text-ink-fg " +
    "shadow-[inset_0_1px_0_0_color-mix(in_oklch,var(--color-ink-fg)_14%,transparent),0_1px_2px_0_color-mix(in_oklch,var(--color-ink)_40%,transparent)]",
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
  spotlight,
  tone = "default",
  className,
  ...props
}: SurfaceProps) {
  const classes = cn(
    "rounded-2xl border",
    TONE[tone],
    padded && "p-5",
    interactive &&
      "transition-[translate,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise",
    // `.spot` paints inside the box, so it needs a clip and a positioned parent.
    spotlight && "relative overflow-hidden",
    className,
  )

  if (spotlight) {
    const spotTag = Tag === "div" || Tag === "section" || Tag === "article" ? Tag : "div"
    return <Spotlight as={spotTag} className={classes} {...props} />
  }
  return <Tag className={classes} {...props} />
}
