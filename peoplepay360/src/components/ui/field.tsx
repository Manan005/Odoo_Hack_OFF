import { ChevronDown } from "lucide-react"
import * as React from "react"
import { NumberTicker } from "@/components/ui/number-ticker"
import { cn } from "@/lib/utils"

/*
 * Border colours are utilities; the focus halo, the 1px inset highlight and
 * the resting inner shadow are one box-shadow transition in `.control`
 * (primitives.css), as is the one-shot shake keyed by aria-invalid.
 */
const control =
  "control w-full rounded-lg border bg-surface text-sm text-foreground " +
  "transition-[border-color,box-shadow,background-color] duration-150 ease-out-quart " +
  "hover:border-border-strong " +
  "focus:border-primary focus:outline-none " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted/70 disabled:text-muted-foreground disabled:hover:border-border"

const errorBorder = "border-danger focus:border-danger"

// ─────────────────────────────── Input ───────────────────────────────

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    aria-invalid={error || undefined}
    className={cn(
      control,
      "h-9 px-3 placeholder:text-subtle-foreground",
      error ? errorBorder : "border-border",
      className,
    )}
    {...props}
  />
))
Input.displayName = "Input"

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <textarea
    ref={ref}
    aria-invalid={error || undefined}
    className={cn(
      control,
      // Grows with its content (Chromium ≥ 123); elsewhere it is a normal textarea.
      "min-h-20 px-3 py-2 [field-sizing:content] placeholder:text-subtle-foreground",
      error ? errorBorder : "border-border",
      className,
    )}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <span className="relative block">
    <select
      ref={ref}
      aria-invalid={error || undefined}
      className={cn(
        control,
        "peer h-9 appearance-none pl-3 pr-9",
        error ? errorBorder : "border-border",
        className,
      )}
      {...props}
    />
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground transition-[rotate,color] duration-200 ease-out-quart peer-focus:rotate-180 peer-focus:text-primary"
    />
  </span>
))
Select.displayName = "Select"

export const Checkbox = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
  <input
    ref={ref}
    type="checkbox"
    className={cn(
      "checkbox focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-1",
      className,
    )}
    {...props}
  />
))
Checkbox.displayName = "Checkbox"

// ─────────────────────────────── Label ───────────────────────────────

export function Label({
  className,
  children,
  required,
  ...props
}: React.LabelHTMLAttributes<HTMLLabelElement> & { required?: boolean }) {
  return (
    <label
      className={cn(
        "text-xs font-medium text-muted-foreground transition-colors duration-150 group-focus-within/field:text-primary",
        className,
      )}
      {...props}
    >
      {children}
      {required && <span className="ml-0.5 text-danger">*</span>}
    </label>
  )
}

// ──────────────────────────── Field wrapper ────────────────────────────

export function Field({
  label,
  htmlFor,
  error,
  hint,
  required,
  className,
  children,
}: {
  label: string
  htmlFor?: string
  error?: string
  hint?: string
  required?: boolean
  className?: string
  children: React.ReactNode
}) {
  const describedBy = error ? `${htmlFor}-error` : hint ? `${htmlFor}-hint` : undefined
  return (
    <div className={cn("group/field space-y-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error && (
        <p id={describedBy} role="alert" className="animate-fade-in text-xs text-danger">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={describedBy} className="text-xs text-subtle-foreground">
          {hint}
        </p>
      )}
    </div>
  )
}

/**
 * Derived values render without input chrome — the user must never be able to
 * type into a computed field (rules.md §6, design.md §6.9). A dotted leader
 * runs from the figure to the "computed" hint, the way a ledger column ties
 * a value to its note.
 *
 * `live` is for values that recompute as the user types: the figure rolls
 * to its new digits and the container pulses once per change.
 */
export function ReadOnlyValue({
  label,
  value,
  hint = "computed",
  live,
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  /** Roll the figure in on every change (string values only). */
  live?: boolean
  className?: string
}) {
  const rolling = live && typeof value === "string"
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <div
        key={live ? String(value) : undefined}
        className={cn(
          "flex h-9 items-center rounded-lg border border-dashed border-border bg-surface-muted/60 px-3",
          live && "animate-fade-in",
        )}
      >
        <span className="text-sm font-medium tabular">
          {rolling ? <NumberTicker value={value} delayStep={30} /> : value}
        </span>
        {hint && (
          <>
            <span
              aria-hidden
              className="mx-2.5 min-w-3 flex-1 self-center border-b border-dotted border-border-strong/80"
            />
            <span className="text-[11px] text-subtle-foreground">{hint}</span>
          </>
        )}
      </div>
    </div>
  )
}
