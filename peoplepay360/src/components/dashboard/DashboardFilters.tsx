"use client"

import { EmployeeType } from "@prisma/client"
import { Building2, SlidersHorizontal } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { Field, Select } from "@/components/ui/field"
import { Surface } from "@/components/ui/surface"
import { EMPLOYEE_TYPE_LABEL } from "@/lib/validation/employee"

export interface PeriodOption {
  value: string
  label: string
}

/**
 * Filters live in the URL, so a filtered dashboard is shareable and
 * refresh-safe, and the page stays a Server Component (rules.md §2.4).
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

  const write = (key: string, value: string) => {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/payroll/dashboard?${next.toString()}`)
  }

  return (
    <Surface className="mb-5 grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-[auto_1fr_1fr_1fr_auto] lg:items-end">
      <div className="hidden h-9 items-center gap-2 pr-2 text-xs font-medium text-muted-foreground lg:flex">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden />
        Filters
      </div>

      <Field label="Period" htmlFor="period">
        <Select
          id="period"
          value={current.period}
          onChange={(e) => write("period", e.target.value)}
        >
          {periods.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Department" htmlFor="departmentId">
        <Select
          id="departmentId"
          value={current.departmentId}
          onChange={(e) => write("departmentId", e.target.value)}
        >
          <option value="">All Departments</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="Employee Type" htmlFor="employeeType">
        <Select
          id="employeeType"
          value={current.employeeType}
          onChange={(e) => write("employeeType", e.target.value)}
        >
          <option value="">All Types</option>
          {Object.values(EmployeeType).map((t) => (
            <option key={t} value={t}>
              {EMPLOYEE_TYPE_LABEL[t]}
            </option>
          ))}
        </Select>
      </Field>

      <div className="flex h-9 items-center gap-2 self-end rounded-lg bg-surface-muted/70 px-3 text-sm ring-1 ring-inset ring-border/60">
        <Building2 className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        <span className="font-medium">{companyName}</span>
      </div>
    </Surface>
  )
}
