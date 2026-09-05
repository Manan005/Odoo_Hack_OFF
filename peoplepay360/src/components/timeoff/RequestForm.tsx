"use client"

import { TimeOffUnit } from "@prisma/client"
import { Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveRequest } from "@/actions/timeoff.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Field, Input, Select, Textarea } from "@/components/ui/field"
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
          className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger"
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
          <p
            className={cn(
              "mt-4 flex items-start gap-2 rounded-lg px-3 py-2 text-xs ring-1 ring-inset",
              // Nothing left to draw on is a warning, not a neutral note.
              v.employeeId && (selectedRemaining === null || selectedRemaining <= 0)
                ? "bg-warning-subtle text-warning ring-warning/25"
                : "bg-info-subtle text-info ring-info/20",
            )}
          >
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>
              {selected.name} draws on an allocation.
              {!v.employeeId
                ? " Select an employee to see the remaining balance."
                : selectedRemaining === null
                  ? " This employee has no approved allocation of this type — one is required before the leave can be requested."
                  : ` ${formatDuration(selectedRemaining, selected.unit)} remaining — approving this request will consume from it.`}
            </span>
          </p>
        )}

        {v.id && duration && (
          <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-border pt-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">Duration</dt>
              <dd className="mt-1 font-medium tabular">{duration}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                Allocation Used
              </dt>
              <dd className="mt-1 font-medium">
                {allocationLabel ?? (
                  <span className="text-muted-foreground">none — type needs no allocation</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </FormSection>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={submit} loading={pending} loadingText="Saving…">
            {v.id ? "Save Changes" : "Submit Request"}
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
