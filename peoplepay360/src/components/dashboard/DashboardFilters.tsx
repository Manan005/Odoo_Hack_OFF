"use client"

import { EmployeeType } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useSearchParams } from "next/navigation"
import { Field, Select } from "@/components/ui/field"
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
    <div className="mb-5 grid grid-cols-1 gap-4 rounded-lg border border-border bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4">
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

      <Field label="Company">
        <div className="flex h-9 items-center rounded-md bg-surface-muted px-3 text-sm">
          {companyName}
        </div>
      </Field>
    </div>
  )
}
