"use client"

import { EmployeeType } from "@prisma/client"
import { ArrowRight, Check, Plus, X } from "lucide-react"
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
import { fmtRange } from "@/lib/dates"
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

const eyebrow = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

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

  const structureName = structures.find((s) => s.id === scope.structureId)?.name ?? "—"
  const periodLabel =
    scope.periodStart && scope.periodEnd
      ? fmtRange(new Date(scope.periodStart), new Date(scope.periodEnd))
      : "—"

  const closeButton = (
    <button
      type="button"
      aria-label="Close"
      onClick={close}
      className="rounded-lg p-1.5 text-muted-foreground transition-colors duration-100 hover:bg-surface-hover hover:text-foreground active:scale-95"
    >
      <X className="h-4 w-4" aria-hidden />
    </button>
  )

  // The progress rail's fill scales to the step; the transition in
  // payroll.css animates it between steps.
  const stepIndicator = (
    <div className="flex items-center gap-2.5" aria-label={`Step ${step} of 2`}>
      <span className="text-[11px] font-medium tabular text-muted-foreground">
        Step {step} of 2
      </span>
      <span className="wiz-rail" aria-hidden>
        <span style={{ ["--p" as string]: step === 1 ? 0.5 : 1 }} />
      </span>
    </div>
  )

  return (
    <>
      <Button onClick={() => setOpen(true)} className="pl-3">
        <Plus className="h-4 w-4" aria-hidden />
        New payrun
      </Button>

      <dialog
        ref={dialogRef}
        onClose={close}
        className="w-full max-w-3xl rounded-2xl border border-border/70 bg-surface p-0 text-foreground shadow-modal backdrop:bg-transparent"
      >
        {step === 1 ? (
          <div key="step-1" className="wiz-step">
            <header className="flex items-center justify-between border-b border-border/70 px-6 py-4">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  New pay run
                </p>
                <h2 className="text-lg font-semibold tracking-tight">Define the scope</h2>
              </div>
              <div className="flex items-center gap-4">
                {stepIndicator}
                {closeButton}
              </div>
            </header>

            <div className="grid grid-cols-1 gap-x-8 gap-y-5 px-6 py-6 md:grid-cols-2">
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
                      aria-pressed={scope.employeeTypes.includes(t)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-[background-color,border-color,color,transform] duration-150 active:scale-95",
                        scope.employeeTypes.includes(t)
                          ? "border-primary/50 bg-primary-subtle text-primary"
                          : "border-border text-muted-foreground hover:border-border-strong hover:bg-surface-hover hover:text-foreground",
                      )}
                    >
                      {EMPLOYEE_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-border/70 bg-surface-muted/50 px-6 py-4">
              <p className="text-xs text-muted-foreground">
                Continue only looks up who has a contract in this period. Nothing is written yet.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={close} disabled={pending}>
                  Cancel
                </Button>
                <Button onClick={onContinue} loading={pending} loadingText="Finding employees…">
                  Continue
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            </footer>
          </div>
        ) : (
          <div key="step-2" className="wiz-step">
            <header className="flex items-center justify-between border-b border-border/70 px-6 py-4">
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-primary">
                  New pay run
                </p>
                <h2 className="text-lg font-semibold tracking-tight">Confirm the employees</h2>
              </div>
              <div className="flex items-center gap-4">
                {stepIndicator}
                {closeButton}
              </div>
            </header>

            {/* Resolution summary — what Continue found, before anything is written. */}
            <dl className="stagger grid grid-cols-3 gap-4 border-b border-border/70 bg-surface-muted/40 px-6 py-3.5">
              <div>
                <dt className={eyebrow}>Resolved</dt>
                <dd className="mt-0.5 text-sm font-semibold tabular">
                  {eligible.length} employee{eligible.length === 1 ? "" : "s"}{" "}
                  <span className="font-normal text-muted-foreground">with a running contract</span>
                </dd>
              </div>
              <div>
                <dt className={eyebrow}>Structure</dt>
                <dd className="mt-0.5 truncate text-sm font-medium">{structureName}</dd>
              </div>
              <div>
                <dt className={eyebrow}>Period</dt>
                <dd className="mt-0.5 text-sm font-medium tabular">{periodLabel}</dd>
              </div>
            </dl>

            <div className="flex items-center gap-3 border-b border-border/70 px-6 py-3">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search employees…"
                className="h-8 w-72 text-xs"
              />
              <span className="ml-auto rounded-md bg-surface-muted px-2 py-1 text-xs tabular text-muted-foreground">
                <span className="font-semibold text-foreground">{selected.size}</span> of{" "}
                {eligible.length} selected
              </span>
            </div>

            <div className="max-h-[20rem] overflow-y-auto">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10 bg-surface-muted backdrop-blur">
                  <tr className="border-b border-border/70">
                    <th className="w-10 px-4 py-2.5">
                      <Checkbox
                        checked={allVisibleSelected}
                        onChange={toggleAll}
                        aria-label="Select all"
                      />
                    </th>
                    {["Employee", "Schedule", "Contract from", "Wage"].map((h, i) => (
                      <th
                        key={h}
                        className={cn(
                          "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                          i === 3 ? "text-right" : "text-left",
                        )}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="stagger-rows">
                  {visible.map((e) => (
                    <tr
                      key={e.id}
                      aria-selected={selected.has(e.id)}
                      className={cn(
                        "cursor-pointer border-b border-border/60 transition-colors duration-100 last:border-0",
                        selected.has(e.id) ? "bg-primary-subtle/40" : "hover:bg-surface-hover",
                      )}
                      onClick={() =>
                        setSelected((prev) => {
                          const next = new Set(prev)
                          if (next.has(e.id)) next.delete(e.id)
                          else next.add(e.id)
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
                        <span className="ml-1.5 font-mono text-[11px] text-subtle-foreground">
                          {e.employeeCode}
                        </span>
                        {e.department && (
                          <span className="ml-1.5 text-xs text-muted-foreground">
                            {e.department}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {e.scheduleName ?? "—"}
                        {e.hoursPerWeek > 0 && (
                          <span className="ml-1 text-xs tabular">· {e.hoursPerWeek} h/wk</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-sm tabular text-muted-foreground">
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

            <footer className="flex items-center justify-between gap-2 border-t border-border/70 bg-surface-muted/50 px-6 py-4">
              <p className="text-xs text-muted-foreground">
                Create writes the payrun and one draft payslip per selected employee.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => setStep(1)} disabled={pending}>
                  Back
                </Button>
                <Button
                  onClick={onCreate}
                  disabled={selected.size === 0}
                  loading={pending}
                  loadingText={`Creating ${selected.size} payslip${selected.size === 1 ? "" : "s"}…`}
                >
                  <Check className="h-4 w-4" aria-hidden />
                  Create payrun ({selected.size})
                </Button>
              </div>
            </footer>
          </div>
        )}
      </dialog>
    </>
  )
}
