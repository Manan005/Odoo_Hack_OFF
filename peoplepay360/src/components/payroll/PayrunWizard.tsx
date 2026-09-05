"use client"

import { EmployeeType } from "@prisma/client"
import { X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useRef, useState, useTransition } from "react"
import { toast } from "sonner"
import {
  createPayrun,
  listEligibleEmployees,
  type EligibleEmployee,
} from "@/actions/payrun.actions"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Input, Select } from "@/components/ui/field"
import { formatMoneyCompact } from "@/lib/money"
import { cn } from "@/lib/utils"
import { EMPLOYEE_TYPE_LABEL } from "@/lib/validation/employee"

interface Scope {
  name: string
  structureId: string
  periodStart: string
  periodEnd: string
  employeeTypes: EmployeeType[]
  departmentId: string
}

const thisMonth = () => {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth(), 1)
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const iso = (d: Date) => d.toISOString().slice(0, 10)
  return { start: iso(start), end: iso(end) }
}

/**
 * Two-step wizard. Step 1 and Continue write nothing — only "Create Payrun"
 * calls a mutating action (AC-M8-1).
 */
export function PayrunWizard({
  structures,
  departments,
}: {
  structures: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
}) {
  const router = useRouter()
  const dialogRef = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<1 | 2>(1)
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const month = thisMonth()
  const [scope, setScope] = useState<Scope>({
    name: "",
    structureId: structures[0]?.id ?? "",
    periodStart: month.start,
    periodEnd: month.end,
    employeeTypes: [],
    departmentId: "",
  })

  const [eligible, setEligible] = useState<EligibleEmployee[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState("")

  // Native <dialog> gives focus trapping and Escape handling for free.
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const reset = () => {
    setStep(1)
    setEligible([])
    setSelected(new Set())
    setSearch("")
    setErrors({})
  }

  const close = () => {
    setOpen(false)
    reset()
  }

  const toggleType = (t: EmployeeType) =>
    setScope((prev) => ({
      ...prev,
      employeeTypes: prev.employeeTypes.includes(t)
        ? prev.employeeTypes.filter((x) => x !== t)
        : [...prev.employeeTypes, t],
    }))

  // Continue only fetches — it does not create the payrun.
  const onContinue = () => {
    setErrors({})
    startTransition(async () => {
      const result = await listEligibleEmployees(scope)
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      if (result.data.length === 0) {
        toast.error("No employees have a contract covering that period.")
        return
      }
      setEligible(result.data)
      setSelected(new Set(result.data.map((e) => e.id)))
      setStep(2)
    })
  }

  const onCreate = () => {
    startTransition(async () => {
      const result = await createPayrun({ ...scope, employeeIds: [...selected] })
      if (!result.ok) {
        setErrors(result.fieldErrors ?? {})
        toast.error(result.message)
        return
      }
      toast.success(`Payrun created with ${selected.size} payslips.`)
      close()
      router.push(`/payroll/payruns/${result.data.id}`)
      router.refresh()
    })
  }

  const visible = eligible.filter((e) =>
    search
      ? `${e.name} ${e.employeeCode} ${e.department ?? ""}`
          .toLowerCase()
          .includes(search.toLowerCase())
      : true,
  )
  const allVisibleSelected = visible.length > 0 && visible.every((e) => selected.has(e.id))

  const toggleAll = () =>
    setSelected((prev) => {
      const next = new Set(prev)
      if (allVisibleSelected) visible.forEach((e) => next.delete(e.id))
      else visible.forEach((e) => next.add(e.id))
      return next
    })

  return (
    <>
      <Button onClick={() => setOpen(true)}>NEW</Button>

      <dialog
        ref={dialogRef}
        onClose={close}
        className="w-full max-w-3xl rounded-lg border border-border bg-surface p-0 text-foreground shadow-modal backdrop:bg-black/40"
      >
        {step === 1 ? (
          <div>
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-xl font-semibold">New Pay Run</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="rounded p-1 text-muted-foreground hover:bg-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="grid grid-cols-1 gap-x-8 gap-y-4 px-5 py-5 md:grid-cols-2">
              <Field label="Pay Run Name" htmlFor="name" hint="Defaults to the period month.">
                <Input
                  id="name"
                  value={scope.name}
                  placeholder="February 2026"
                  onChange={(e) => setScope((p) => ({ ...p, name: e.target.value }))}
                />
              </Field>

              <Field
                label="Pay Structure"
                htmlFor="structureId"
                required
                error={errors.structureId}
              >
                <Select
                  id="structureId"
                  value={scope.structureId}
                  error={Boolean(errors.structureId)}
                  onChange={(e) => setScope((p) => ({ ...p, structureId: e.target.value }))}
                >
                  <option value="">Select structure</option>
                  {structures.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Period Start" htmlFor="periodStart" required error={errors.periodStart}>
                <Input
                  id="periodStart"
                  type="date"
                  value={scope.periodStart}
                  error={Boolean(errors.periodStart)}
                  onChange={(e) => setScope((p) => ({ ...p, periodStart: e.target.value }))}
                />
              </Field>

              <Field label="Period End" htmlFor="periodEnd" required error={errors.periodEnd}>
                <Input
                  id="periodEnd"
                  type="date"
                  value={scope.periodEnd}
                  error={Boolean(errors.periodEnd)}
                  onChange={(e) => setScope((p) => ({ ...p, periodEnd: e.target.value }))}
                />
              </Field>

              <Field label="Department" htmlFor="departmentId" hint="Optional filter.">
                <Select
                  id="departmentId"
                  value={scope.departmentId}
                  onChange={(e) => setScope((p) => ({ ...p, departmentId: e.target.value }))}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>

              <Field label="Employee Types" hint="None selected means all types.">
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {Object.values(EmployeeType).map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => toggleType(t)}
                      className={cn(
                        "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
                        scope.employeeTypes.includes(t)
                          ? "border-primary bg-primary-subtle text-primary"
                          : "border-border text-muted-foreground hover:bg-surface-hover",
                      )}
                    >
                      {EMPLOYEE_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <Button variant="ghost" onClick={close} disabled={pending}>
                Cancel
              </Button>
              <Button onClick={onContinue} loading={pending} loadingText="Finding employees…">
                Continue
              </Button>
            </footer>
          </div>
        ) : (
          <div>
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <h2 className="text-xl font-semibold">Select Employee Records</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={close}
                className="rounded p-1 text-muted-foreground hover:bg-surface-hover"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex items-center gap-3 border-b border-border px-5 py-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees..."
                className="h-8 w-72 text-xs"
              />
              <span className="ml-auto text-xs tabular text-muted-foreground">
                {selected.size} of {eligible.length} selected
              </span>
            </div>

            <div className="max-h-[22rem] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 bg-surface-muted">
                  <tr className="border-b border-border">
                    <th className="w-10 px-4 py-2.5">
                      <Checkbox
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        aria-label="Select all"
                      />
                    </th>
                    {["Employee", "Working Hours", "Start Date", "Wage"].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
                          i === 3 ? "text-right" : "text-left",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visible.map((e) => (
                    <tr
                      key={e.id}
                      className="cursor-pointer border-b border-border last:border-0 hover:bg-surface-hover"
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          next.has(e.id) ? next.delete(e.id) : next.add(e.id)
                          return next
                        })
                      }
                    >
                      <td className="px-4 py-2.5">
                        <Checkbox
                          checked={selected.has(e.id)}
                          onChange={() => {}}
                          aria-label={`Select ${e.name}`}
                        />
                      </td>
                      <td className="px-4 py-2.5 text-sm">
                        <span className="font-medium">{e.name}</span>
                        {e.department && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {e.department}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {e.hoursPerWeek > 0 ? `${e.hoursPerWeek} hours/week` : "—"}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {e.contractStart}
                      </td>
                      <td className="px-4 py-2.5 text-right text-sm tabular">
                        {formatMoneyCompact(e.wage)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
              <p className="text-xs italic text-muted-foreground">
                The Payrun is created only after employee selection.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
                  Back
                </Button>
                <Button
                  onClick={onCreate}
                  disabled={selected.size === 0}
                  loading={pending}
                  loadingText="Creating…"
                >
                  Create Payrun ({selected.size})
                </Button>
              </div>
            </footer>
          </div>
        )}
      </dialog>
    </>
  )
}
