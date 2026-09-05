"use client"

import { TimeOffUnit } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveAllocation } from "@/actions/timeoff.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Field, Input, ReadOnlyValue, Select, Textarea } from "@/components/ui/field"
import { formatDuration } from "@/lib/money"

export interface AllocationFormValues {
  id?: string
  employeeId: string
  typeId: string
  allocated: string
  validityLabel: string
  description: string
}

export function AllocationForm({
  initial,
  employees,
  types,
  taken,
  unit = TimeOffUnit.DAYS,
  readOnly = false,
}: {
  initial: AllocationFormValues
  employees: Array<{ id: string; name: string }>
  types: Array<{ id: string; name: string; unit: TimeOffUnit }>
  taken?: string
  unit?: TimeOffUnit
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<AllocationFormValues>(initial)

  const set = <K extends keyof AllocationFormValues>(k: K, value: AllocationFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  const selectedUnit = types.find((t) => t.id === v.typeId)?.unit ?? unit
  const takenNum = Number(taken ?? 0)
  const remaining = Number(v.allocated || 0) - takenNum

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const result = await saveAllocation(v.id ? { ...v, id: v.id } : v)
      if (result.ok) {
        toast.success("Allocation saved.")
        router.push(`/time-off/allocations/${result.data.id}`)
        router.refresh()
        return
      }
      setErrors(result.fieldErrors ?? {})
      toast.error(result.message)
    })
  }

  return (
    <div className="space-y-5">
      <FormSection title="Allocation">
        <FieldGrid>
          <Field label="Employee" htmlFor="employeeId" required error={errors.employeeId}>
            <Select
              id="employeeId"
              value={v.employeeId}
              disabled={readOnly || Boolean(v.id)}
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
              disabled={readOnly || Boolean(v.id)}
              error={Boolean(errors.typeId)}
              onChange={(e) => set("typeId", e.target.value)}
            >
              <option value="">Select type</option>
              {types.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Allocated"
            htmlFor="allocated"
            required
            error={errors.allocated}
            hint={selectedUnit === TimeOffUnit.DAYS ? "In days." : "In hours."}
          >
            <Input
              id="allocated"
              inputMode="decimal"
              value={v.allocated}
              placeholder="20"
              className="text-right tabular"
              disabled={readOnly}
              error={Boolean(errors.allocated)}
              onChange={(e) => set("allocated", e.target.value)}
            />
          </Field>

          <Field label="Validity" htmlFor="validityLabel">
            <Input
              id="validityLabel"
              value={v.validityLabel}
              placeholder="2026 Annual Balance"
              disabled={readOnly}
              onChange={(e) => set("validityLabel", e.target.value)}
            />
          </Field>

          {/* Derived — approve/refuse maintain these, never the form (BR-T5). */}
          {v.id && (
            <>
              <ReadOnlyValue
                label="Taken"
                value={formatDuration(takenNum, selectedUnit)}
                hint="from approved requests"
              />
              <ReadOnlyValue
                label="Remaining"
                value={formatDuration(remaining, selectedUnit)}
                hint="allocated − taken"
              />
            </>
          )}

          <Field label="Description" htmlFor="description" className="md:col-span-2">
            <Textarea
              id="description"
              rows={2}
              value={v.description}
              placeholder="Annual leave balance granted at start of policy year."
              disabled={readOnly}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={submit} loading={pending} loadingText="Saving…">
            {v.id ? "Save Changes" : "Create Allocation"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/time-off/allocations")}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
