import { ChevronDown } from "lucide-react"
import * as React from "react"
import { cn } from "@/lib/utils"

const control =
  "w-full rounded-lg border bg-surface text-sm text-foreground " +
  "transition-[border-color,box-shadow,background-color] duration-150 ease-out-quart " +
  "hover:border-border-strong " +
  "focus:border-primary focus:outline-none focus:ring-[3px] focus:ring-primary/15 " +
  "disabled:cursor-not-allowed disabled:bg-surface-muted/70 disabled:text-muted-foreground disabled:hover:border-border"

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
      error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-border",
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
      "px-3 py-2 placeholder:text-subtle-foreground",
      error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-border",
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
        "h-9 appearance-none pl-3 pr-9",
        error ? "border-danger focus:border-danger focus:ring-danger/15" : "border-border",
        className,
      )}
      {...props}
    />
    <ChevronDown
      aria-hidden
      className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground"
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
      className={cn("text-xs font-medium text-muted-foreground", className)}
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
    <div className={cn("space-y-1.5", className)}>
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
 * type into a computed field (rules.md §6, design.md §6.9).
 */
export function ReadOnlyValue({
  label,
  value,
  hint = "computed",
  className,
}: {
  label: string
  value: React.ReactNode
  hint?: string
  className?: string
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      <div className="flex h-9 items-center justify-between rounded-lg border border-dashed border-border bg-surface-muted/60 px-3">
        <span className="text-sm font-medium tabular">{value}</span>
        {hint && <span className="text-[11px] text-subtle-foreground">{hint}</span>}
      </div>
    </div>
  )
}
