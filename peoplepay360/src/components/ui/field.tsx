import * as React from "react"
import { cn } from "@/lib/utils"

// ─────────────────────────────── Input ───────────────────────────────

export const Input = React.forwardRef<
  HTMLInputElement,
  React.InputHTMLAttributes<HTMLInputElement> & { error?: boolean }
>(({ className, error, ...props }, ref) => (
  <input
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border bg-surface px-3 text-sm text-foreground",
      "placeholder:text-subtle-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
      "disabled:cursor-not-allowed disabled:bg-surface-muted disabled:text-muted-foreground",
      error ? "border-danger" : "border-border",
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
    className={cn(
      "w-full rounded-md border bg-surface px-3 py-2 text-sm text-foreground",
      "placeholder:text-subtle-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
      error ? "border-danger" : "border-border",
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
  <select
    ref={ref}
    className={cn(
      "h-9 w-full rounded-md border bg-surface px-3 text-sm text-foreground",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
      error ? "border-danger" : "border-border",
      className,
    )}
    {...props}
  />
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
      "h-4 w-4 cursor-pointer rounded border-border accent-[var(--color-primary)]",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
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
        "text-xs font-medium uppercase tracking-wide text-muted-foreground",
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
    <div className={cn("space-y-1.5", className)}>
      <Label htmlFor={htmlFor} required={required}>
        {label}
      </Label>
      {children}
      {error && (
        <p id={describedBy} className="text-xs text-danger">
          {error}
        </p>
      )}
      {!error && hint && (
        <p id={describedBy} className="text-xs text-muted-foreground">
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
      <div className="flex h-9 items-center justify-between rounded-md bg-surface-muted px-3">
        <span className="text-sm font-medium tabular">{value}</span>
        {hint && <span className="text-[11px] text-subtle-foreground">{hint}</span>}
      </div>
    </div>
  )
}
