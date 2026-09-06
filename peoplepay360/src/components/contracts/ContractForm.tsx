"use client"

import { ContractStatus } from "@prisma/client"
import { formatDistanceStrict, isValid, parseISO } from "date-fns"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createContract, updateContract } from "@/actions/contract.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { Field, Input, Select, Textarea } from "@/components/ui/field"
import { fmtDate } from "@/lib/dates"
import { formatINR } from "@/lib/money"
import { cn } from "@/lib/utils"
import { CONTRACT_STATUS_LABEL } from "@/lib/validation/contract"

export interface Option {
  id: string
  name: string
}

export interface ContractFormValues {
  id?: string
  reference?: string
  employeeId: string
  startDate: string
  endDate: string
  wage: string
  status: ContractStatus
  departmentId: string
  jobPositionId: string
  workingScheduleId: string
  salaryStructureId: string
  notes: string
}

// Display only: the typed wage echoed back in Indian grouping. No arithmetic.
const WAGE_RE = /^\d{1,10}(\.\d{1,2})?$/
const wagePreview = (raw: string): string | null =>
  WAGE_RE.test(raw.trim()) ? formatINR(raw.trim()) : null

const parseDay = (s: string): Date | null => {
  if (!s) return null
  const d = parseISO(s)
  return isValid(d) ? d : null
}

/**
 * A presentation-only rail drawn from the two date inputs. A bounded term
 * fills the whole rail with today marked on it; an open-ended term dissolves
 * to the right. The badge shows the selected status as typed — BR-C4's
 * derived "Expired" belongs to the header badge, not to this preview.
 */
function ContractTimeline({
  startDate,
  endDate,
  status,
}: {
  startDate: string
  endDate: string
  status: ContractStatus
}) {
  const start = parseDay(startDate)
  const end = parseDay(endDate)
  const today = new Date()
  const inverted = start !== null && end !== null && end < start

  let todayPct: number | null = null
  if (start && end && !inverted && end > start) {
    const t = (today.getTime() - start.getTime()) / (end.getTime() - start.getTime())
    // One decimal: the server render and the client hydration are milliseconds
    // apart, and a finer figure would differ between them on a long term.
    todayPct = Number(Math.min(100, Math.max(0, t * 100)).toFixed(1))
  }

  const span = inverted
    ? "ends before it starts"
    : start && end
      ? formatDistanceStrict(start, end)
      : start
        ? "open-ended"
        : "pick a start date"

  const phase =
    !start || inverted
      ? null
      : start > today
        ? `starts in ${formatDistanceStrict(today, start)}`
        : end && end < today
          ? `ended ${formatDistanceStrict(end, today)} ago`
          : `running for ${formatDistanceStrict(start, today)}`

  return (
    <div className="mt-6 rounded-xl bg-surface-muted/60 p-4 ring-1 ring-inset ring-border/60">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Term
          </p>
          <StatusBadge status={status} />
        </div>
        {phase && (
          <p key={phase} className="animate-fade-in text-xs text-muted-foreground">
            {phase}
          </p>
        )}
      </div>

      <div className="flex items-center justify-between text-xs">
        <span className={cn("tabular font-medium", !start && "text-subtle-foreground")}>
          {start ? fmtDate(start) : "Start"}
        </span>
        <span className={cn("text-muted-foreground", inverted && "text-danger")}>{span}</span>
        <span className={cn("tabular font-medium", !end && "text-subtle-foreground")}>
          {end ? fmtDate(end) : start ? "open-ended" : "End"}
        </span>
      </div>

      <div className="relative mt-2 h-2 rounded-full bg-border/60">
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 origin-left rounded-full transition-[transform,opacity] duration-500 ease-out-quart",
            inverted ? "bg-danger/70" : "bg-primary",
            !end && !inverted && "fade-right",
          )}
          style={{ transform: `scaleX(${start ? 1 : 0})`, opacity: start ? 1 : 0 }}
        />
        {todayPct !== null && (
          <span
            aria-label="Today"
            title="Today"
            className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-surface shadow-card ring-2 ring-primary transition-[left] duration-500 ease-out-quart"
            style={{ left: `${todayPct}%` }}
          />
        )}
      </div>
    </div>
  )
}

export function ContractForm({
  initial,
  employees,
  departments,
  positions,
  schedules,
  structures,
}: {
  initial: ContractFormValues
  employees: Option[]
  departments: Option[]
  positions: Option[]
  schedules: Option[]
  structures: Option[]
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [v, setV] = useState<ContractFormValues>(initial)

  const set = <K extends keyof ContractFormValues>(k: K, value: ContractFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  const preview = wagePreview(v.wage)

  const submit = () => {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = v.id
        ? await updateContract({ ...v, id: v.id })
        : await createContract(v)

      if (result.ok) {
        toast.success(v.id ? "Contract updated." : "Contract created.")
        router.push(`/contracts/${result.data.id}`)
        router.refresh()
        return
      }
      setErrors(result.fieldErrors ?? {})
      setFormError(result.message)
      toast.error(result.message)
    })
  }

  return (
    <div className="space-y-5">
      {formError && (
        <p
          role="alert"
          className="animate-fade-in rounded-xl border border-danger/40 bg-danger-subtle px-4 py-3 text-sm text-danger"
        >
          {formError}
        </p>
      )}

      <FormSection title="Employment terms">
        <FieldGrid>
          <Field label="Employee" htmlFor="employeeId" required error={errors.employeeId}>
            <Select
              id="employeeId"
              value={v.employeeId}
              error={Boolean(errors.employeeId)}
              onChange={(e) => set("employeeId", e.target.value)}
            >
              <option value="">Select employee</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status" htmlFor="status" error={errors.status}>
            <Select
              id="status"
              value={v.status}
              onChange={(e) => set("status", e.target.value as ContractStatus)}
            >
              {Object.values(ContractStatus).map((s) => (
                <option key={s} value={s}>
                  {CONTRACT_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Start Date" htmlFor="startDate" required error={errors.startDate}>
            <Input
              id="startDate"
              type="date"
              value={v.startDate}
              error={Boolean(errors.startDate)}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>

          <Field
            label="End Date"
            htmlFor="endDate"
            error={errors.endDate}
            hint="Leave blank for an open-ended contract."
          >
            <Input
              id="endDate"
              type="date"
              value={v.endDate}
              error={Boolean(errors.endDate)}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>

          <Field
            label="Wage / Month"
            htmlFor="wage"
            required
            error={errors.wage}
            hint="Payroll reads this as the contract wage."
          >
            <div className="flex items-center gap-2">
              <Input
                id="wage"
                inputMode="decimal"
                value={v.wage}
                placeholder="85000"
                className="text-right tabular"
                error={Boolean(errors.wage)}
                onChange={(e) => set("wage", e.target.value)}
              />
              <span
                key={preview ?? "none"}
                aria-live="polite"
                className={cn(
                  "settle inline-flex h-9 shrink-0 items-center rounded-lg px-2.5 text-sm font-semibold tabular ring-1 ring-inset",
                  preview
                    ? "bg-primary-subtle text-primary ring-primary/15"
                    : "bg-surface-muted text-subtle-foreground ring-border/60",
                )}
              >
                {preview ?? "₹ —"}
              </span>
            </div>
          </Field>

          <Field label="Department" htmlFor="departmentId">
            <Select
              id="departmentId"
              value={v.departmentId}
              onChange={(e) => set("departmentId", e.target.value)}
            >
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Job Position" htmlFor="jobPositionId">
            <Select
              id="jobPositionId"
              value={v.jobPositionId}
              onChange={(e) => set("jobPositionId", e.target.value)}
            >
              <option value="">—</option>
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Working Schedule" htmlFor="workingScheduleId">
            <Select
              id="workingScheduleId"
              value={v.workingScheduleId}
              onChange={(e) => set("workingScheduleId", e.target.value)}
            >
              <option value="">—</option>
              {schedules.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGrid>

        <ContractTimeline startDate={v.startDate} endDate={v.endDate} status={v.status} />
      </FormSection>

      <FormSection title="Salary structure">
        <p className="mb-4 text-xs text-muted-foreground">
          The structure supplies the salary rules payroll runs for this contract&apos;s payslips.
        </p>
        <FieldGrid>
          <Field label="Salary Structure" htmlFor="salaryStructureId">
            <Select
              id="salaryStructureId"
              value={v.salaryStructureId}
              onChange={(e) => set("salaryStructureId", e.target.value)}
            >
              <option value="">—</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Notes" htmlFor="notes" className="md:col-span-2">
            <Textarea
              id="notes"
              rows={2}
              value={v.notes}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending} loadingText="Saving…">
          {v.id ? "Save changes" : "Create contract"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/contracts")} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
