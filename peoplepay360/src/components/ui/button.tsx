import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium select-none " +
    "transition-[background-color,color,border-color,box-shadow,transform,opacity] duration-150 ease-out-quart " +
    "active:scale-[0.98] " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background " +
    "disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary:
          "btn-sheen bg-primary text-primary-fg shadow-primary hover:bg-primary-hover hover:shadow-primary-hover",
        outline:
          "border border-border bg-surface text-foreground shadow-card hover:border-border-strong hover:bg-surface-hover",
        soft: "bg-primary-subtle text-primary hover:bg-primary-subtle/70",
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

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, loadingText, children, disabled, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {loading && loadingText ? loadingText : children}
    </button>
  ),
)
Button.displayName = "Button"

export { buttonVariants }
