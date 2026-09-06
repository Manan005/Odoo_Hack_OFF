import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "@/lib/utils"

/*
 * Tailwind v4 emits `translate` / `scale` as individual properties, so the
 * transition list must name them — a bare `transform` entry would leave the
 * press scale and hover lift snapping.
 */
const buttonVariants = cva(
  "btn-press relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium select-none " +
    "transition-[background-color,color,border-color,box-shadow,scale,translate,opacity] duration-150 ease-out-quart " +
    "active:scale-[0.98] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "disabled:pointer-events-none disabled:opacity-50 disabled:data-[loading]:opacity-90 disabled:data-[loading]:cursor-progress",
  {
    variants: {
      variant: {
        primary:
          "btn-sheen bg-primary text-primary-fg shadow-primary hover:bg-primary-hover hover:shadow-primary-hover",
        outline:
          "border border-border bg-surface text-foreground shadow-card hover:-translate-y-px hover:border-border-strong hover:bg-surface-hover hover:shadow-raise active:translate-y-0",
        soft: "bg-primary-subtle text-primary hover:-translate-y-px hover:bg-primary-subtle/70 hover:shadow-card active:translate-y-0",
        ghost: "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
        success: "bg-success text-primary-fg shadow-card hover:opacity-90",
        danger: "border border-danger/40 bg-surface text-danger hover:border-danger hover:bg-danger-subtle",
        "danger-solid": "bg-danger text-primary-fg shadow-card hover:opacity-90",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        xs: "h-7 px-2.5 text-xs",
        sm: "h-8 px-3 text-xs",
        md: "h-9 px-4 text-sm",
        lg: "h-10 px-5 text-sm",
        icon: "h-9 w-9",
        "icon-sm": "h-8 w-8",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
  /** Shown while `loading` — design.md §7 wants the gerund, e.g. "Computing…". */
  loadingText?: string
}

/** Three stripes breathing in sequence — the brand mark, thinking. */
function Bars() {
  return (
    <span className="btn-bars" aria-hidden>
      <span />
      <span />
      <span />
    </span>
  )
}

/**
 * When a caller drives `loading` (true *or* false) both faces are rendered
 * from the first paint in one grid cell, so the button is already as wide as
 * "Saving…" and the swap is a crossfade rather than a reflow. Buttons that
 * never pass `loading` keep their plain children.
 */
export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, loadingText, children, disabled, ...props }, ref) => {
    const crossfade = typeof loading === "boolean"
    return (
      <button
        ref={ref}
        className={cn(
          buttonVariants({ variant, size }),
          crossfade && "inline-grid place-items-center",
          className,
        )}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        data-loading={loading || undefined}
        {...props}
      >
        {crossfade ? (
          <>
            <span className="btn-face" data-idle="" aria-hidden={loading || undefined}>
              {children}
            </span>
            <span className="btn-face" data-busy="" aria-hidden={!loading || undefined}>
              <Bars />
              {loadingText ?? children}
            </span>
          </>
        ) : (
          children
        )}
      </button>
    )
  },
)
Button.displayName = "Button"

export { buttonVariants }
