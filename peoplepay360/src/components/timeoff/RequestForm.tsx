"use client"

import { TimeOffUnit } from "@prisma/client"
import { AlertTriangle, Wallet } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveRequest } from "@/actions/timeoff.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Field, Input, ReadOnlyValue, Select, Textarea } from "@/components/ui/field"
import { NumberTicker } from "@/components/ui/number-ticker"
import { formatDuration } from "@/lib/money"
import { cn } from "@/lib/utils"

export interface RequestFormValues {
  id?: string
  employeeId: string
  typeId: string
  startDate: string
  endDate: string
  reason: string
}

export interface TypeOption {
  id: string
  name: string
  unit: TimeOffUnit
  requiresAllocation: boolean
}

/**
 * remaining[employeeId][typeId]. A missing entry means the employee has no
 * approved allocation of that type at all, which the form reports differently
 * from an allocation that exists with nothing left on it.
 */
export type RemainingByEmployee = Record<string, Record<string, number>>

export function RequestForm({
  initial,
  employees,
  types,
  remaining,
  duration,
  allocationLabel,
  readOnly = false,
}: {
  initial: RequestFormValues
  employees: Array<{ id: string; name: string }>
  types: TypeOption[]
  /** Balances for every selectable employee, so switching employee is instant. */
  remaining: RemainingByEmployee
  duration?: string
  allocationLabel?: string | null
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [v, setV] = useState<RequestFormValues>(initial)

  const set = <K extends keyof RequestFormValues>(k: K, value: RequestFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  const selected = types.find((t) => t.id === v.typeId)

  // Read against the employee currently chosen in the form — not the one the
  // page was rendered for. null = no approved allocation of that type.
  const remainingFor = (typeId: string): number | null =>
    remaining[v.employeeId]?.[typeId] ?? null

  const selectedRemaining = selected ? remainingFor(selected.id) : null
  // Nothing left to draw on is a warning, not a neutral note.
  const exhausted =
    Boolean(v.employeeId) && (selectedRemaining === null || selectedRemaining <= 0)

  const submit = () => {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = await saveRequest(v.id ? { ...v, id: v.id } : v)
      if (result.ok) {
        toast.success("Request submitted.")
        router.push(`/time-off/requests/${result.data.id}`)
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

      <FormSection title="Request">
        <FieldGrid>
          <Field label="Employee" htmlFor="employeeId" required error={errors.employeeId}>
            <Select
              id="employeeId"
              value={v.employeeId}
              disabled={readOnly || employees.length <= 1}
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

          <Field label="Time Off Type" htmlFor="typeId" required error={errors.typeId}>
            <Select
              id="typeId"
              value={v.typeId}
              disabled={readOnly}
              error={Boolean(errors.typeId)}
              onChange={(e) => set("typeId", e.target.value)}
            >
              <option value="">Select type</option>
              {types.map((t) => {
                const r = remainingFor(t.id)
                // Without an employee there is no balance to report, so the
                // label stays bare rather than claiming zero.
                const suffix =
                  !t.requiresAllocation || !v.employeeId
                    ? ""
                    : r === null
                      ? " — no allocation"
                      : ` — ${formatDuration(r, t.unit)} remaining`
                return (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {suffix}
                  </option>
                )
              })}
            </Select>
          </Field>

          <Field label="Start Date" htmlFor="startDate" required error={errors.startDate}>
            <Input
              id="startDate"
              type="date"
              value={v.startDate}
              disabled={readOnly}
              error={Boolean(errors.startDate)}
              onChange={(e) => set("startDate", e.target.value)}
            />
          </Field>

          <Field
            label="End Date"
            htmlFor="endDate"
            required
            error={errors.endDate}
            hint="Only working days on the employee's schedule are counted."
          >
            <Input
              id="endDate"
              type="date"
              value={v.endDate}
              disabled={readOnly}
              error={Boolean(errors.endDate)}
              onChange={(e) => set("endDate", e.target.value)}
            />
          </Field>

          <Field label="Reason" htmlFor="reason" className="md:col-span-2">
            <Textarea
              id="reason"
              rows={2}
              value={v.reason}
              placeholder="Family vacation"
              disabled={readOnly}
              onChange={(e) => set("reason", e.target.value)}
            />
          </Field>
        </FieldGrid>

        {selected?.requiresAllocation && (
          <div
            key={`${v.employeeId}:${selected.id}`}
            className={cn(
              "panel-in mt-5 flex items-center justify-between gap-4 rounded-xl p-4 ring-1 ring-inset",
              exhausted ? "bg-warning-subtle ring-warning/25" : "bg-info-subtle ring-info/20",
            )}
          >
            <div className="min-w-0">
              <p
                className={cn(
                  "text-[11px] font-semibold uppercase tracking-[0.12em]",
                  exhausted ? "text-warning" : "text-info",
                )}
              >
                Remaining balance
              </p>
              <div className="mt-1.5 leading-none">
                {!v.employeeId ? (
                  <span className="text-sm text-muted-foreground">
                    Select an employee to see the balance.
                  </span>
                ) : selectedRemaining === null ? (
                  <span className="font-display text-2xl font-semibold tracking-tight text-warning">
                    No allocation
                  </span>
                ) : (
                  <NumberTicker
                    value={formatDuration(selectedRemaining, selected.unit)}
                    className={cn(
                      "font-display text-[32px] font-semibold tracking-tight",
                      exhausted ? "text-warning" : "text-foreground",
                    )}
                  />
                )}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {selected.name} draws on an allocation.
                {!v.employeeId
                  ? ""
                  : selectedRemaining === null
                    ? " An approved allocation of this type is required before the leave can be requested."
                    : " Approving this request consumes from it."}
              </p>
            </div>
            <span
              className={cn(
                "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface ring-1",
                exhausted ? "text-warning ring-warning/25" : "text-info ring-info/20",
              )}
            >
              {exhausted ? (
                <AlertTriangle className="h-5 w-5" aria-hidden />
              ) : (
                <Wallet className="h-5 w-5" aria-hidden />
              )}
            </span>
          </div>
        )}

        {v.id && duration && (
          <div className="mt-5 grid grid-cols-1 gap-x-8 gap-y-5 border-t border-border/70 pt-5 md:grid-cols-2">
            {/* Both derived by the server (BR-T4) — shown, never typed. */}
            <ReadOnlyValue label="Duration" value={duration} hint="working days" />
            <ReadOnlyValue
              label="Allocation Used"
              value={
                allocationLabel ?? (
                  <span className="font-normal text-muted-foreground">
                    none — type needs no allocation
                  </span>
                )
              }
              hint=""
            />
          </div>
        )}
      </FormSection>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={submit} loading={pending} loadingText="Saving…">
            {v.id ? "Save changes" : "Submit request"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/time-off/requests")}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
