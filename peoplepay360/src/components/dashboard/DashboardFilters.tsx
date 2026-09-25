"use client"

import { EmployeeType } from "@prisma/client"
import { Building2, ChevronDown, SlidersHorizontal, X } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useTransition, type ReactNode } from "react"
import { Surface } from "@/components/ui/surface"
import { EMPLOYEE_TYPE_LABEL } from "@/lib/validation/employee"

export interface PeriodOption {
  value: string
  label: string
}

/**
 * Filters live in the URL, so a filtered dashboard is shareable and
 * refresh-safe, and the page stays a Server Component (rules.md §2.4).
 * Laid out as one compact rail from sm: three inline selects and the company
 * chip. On a phone the rail becomes a single column — each select full-width
 * and 40px tall, Clear a full-width row, the company chip on its own row.
 */
export function DashboardFilterBar({
  periods,
  departments,
  companyName,
  current,
}: {
  periods: PeriodOption[]
  departments: Array<{ id: string; name: string }>
  companyName: string
  current: { period: string; departmentId: string; employeeType: string }
}) {
  const router = useRouter()
  const params = useSearchParams()
  // The push is a transition: the rail dims until the new scope has its
  // header, then each section streams in behind its own skeleton.
  const [pending, startTransition] = useTransition()
  const go = (href: string) => startTransition(() => router.push(href))

  const write = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    go(`/payroll/dashboard?${next.toString()}`)
  }

  const narrowed = Boolean(current.departmentId || current.employeeType)
  const clear = () => go(`/payroll/dashboard?period=${current.period}`)

  return (
    <Surface
      as="section"
      aria-label="Dashboard filters"
      aria-busy={pending || undefined}
      className="mb-5 grid transition-opacity duration-200 aria-busy:opacity-60 grid-cols-1 gap-2 px-3 py-2.5 sm:flex sm:flex-wrap sm:items-center"
    >
      <span className="inline-flex items-center gap-1.5 pr-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground sm:h-8">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        Filters
      </span>

      <RailSelect id="period" label="Period" value={current.period} onChange={(v) => write("period", v)}>
        {periods.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </RailSelect>

      <RailSelect
        id="departmentId"
        label="Department"
        value={current.departmentId}
        onChange={(v) => write("departmentId", v)}
      >
        <option value="">All</option>
        {departments.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name}
          </option>
        ))}
      </RailSelect>

      <RailSelect
        id="employeeType"
        label="Type"
        value={current.employeeType}
        onChange={(v) => write("employeeType", v)}
      >
        <option value="">All</option>
        {Object.values(EmployeeType).map((t) => (
          <option key={t} value={t}>
            {EMPLOYEE_TYPE_LABEL[t]}
          </option>
        ))}
      </RailSelect>

      {narrowed && (
        <button
          type="button"
          onClick={clear}
          className="animate-scale-in inline-flex h-10 items-center justify-center gap-1 rounded-lg border border-border px-2 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-surface-hover hover:text-foreground sm:h-8 sm:justify-start sm:border-transparent"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
          Clear
        </button>
      )}

      <span className="inline-flex h-9 items-center gap-2 justify-self-start rounded-lg bg-surface-muted/70 px-3 text-xs ring-1 ring-inset ring-border/60 sm:ml-auto sm:h-8">
        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate font-medium">{companyName}</span>
      </span>
    </Surface>
  )
}

/**
 * Inline labelled select sized for the rail; the label is the click target
 * too. Full-width and 40px tall on a phone, intrinsic and 32px from sm.
 */
function RailSelect({
  id,
  label,
  value,
  onChange,
  children,
}: {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  return (
    <label
      htmlFor={id}
      className="flex h-10 w-full items-center overflow-hidden rounded-lg border border-border bg-surface text-xs transition-[border-color,box-shadow] duration-150 ease-out-quart hover:border-border-strong focus-within:border-primary focus-within:ring-[3px] focus-within:ring-primary/15 sm:inline-flex sm:h-8 sm:w-auto"
    >
      <span className="shrink-0 pl-2.5 pr-1 text-[11px] font-medium text-subtle-foreground">
        {label}
      </span>
      <span className="relative min-w-0 flex-1 sm:flex-none">
        <select
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          // Opaque, matching the label wrapper: Chromium seeds the popup's canvas
          // from the select's own background, and a transparent one comes up white.
          className="h-10 w-full appearance-none bg-surface pl-1 pr-7 text-xs font-medium text-foreground focus:outline-none sm:h-8 sm:w-auto"
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground"
        />
      </span>
    </label>
  )
}
