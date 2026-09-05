"use client"

import { ApprovalMode, TimeOffUnit } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveTimeOffType } from "@/actions/timeoff.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field"
import {
  APPROVAL_LABEL,
  DISPLAY_COLORS,
  UNIT_LABEL,
} from "@/lib/validation/timeoff"

export interface TypeFormValues {
  id?: string
  name: string
  unit: TimeOffUnit
  requiresAllocation: boolean
  approvalMode: ApprovalMode
  workEntryLabel: string
  isPaid: boolean
  displayColor: string
  active: boolean
  description: string
}

export const emptyType: TypeFormValues = {
  name: "",
  unit: TimeOffUnit.DAYS,
  requiresAllocation: true,
  approvalMode: ApprovalMode.MANAGER,
  workEntryLabel: "Leave Work Entry",
  isPaid: true,
  displayColor: "blue",
  active: true,
  description: "",
}

export function TypeForm({ initial }: { initial: TypeFormValues }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<TypeFormValues>(initial)

  const set = <K extends keyof TypeFormValues>(k: K, value: TypeFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const result = await saveTimeOffType(v)
      if (result.ok) {
        toast.success("Time off type saved.")
        router.push("/time-off/types")
        router.refresh()
        return
      }
      setErrors(result.fieldErrors ?? {})
      toast.error(result.message)
    })
  }

  return (
    <div className="space-y-5">
      <FormSection title="Policy">
        <p className="mb-4 text-xs text-muted-foreground">
          This defines policy rules, not employee transactions.
        </p>
        <FieldGrid>
          <Field label="Type Name" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              value={v.name}
              placeholder="Paid Time Off"
              error={Boolean(errors.name)}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <Field label="Unit" htmlFor="unit">
            <Select
              id="unit"
              value={v.unit}
              onChange={(e) => set("unit", e.target.value as TimeOffUnit)}
            >
              {Object.values(TimeOffUnit).map((u) => (
                <option key={u} value={u}>
                  {UNIT_LABEL[u]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Approval" htmlFor="approvalMode">
            <Select
              id="approvalMode"
              value={v.approvalMode}
              onChange={(e) => set("approvalMode", e.target.value as ApprovalMode)}
            >
              {Object.values(ApprovalMode).map((a) => (
                <option key={a} value={a}>
                  {APPROVAL_LABEL[a]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Payroll / Work Entry" htmlFor="workEntryLabel">
            <Input
              id="workEntryLabel"
              value={v.workEntryLabel}
              placeholder="Leave Work Entry"
              onChange={(e) => set("workEntryLabel", e.target.value)}
            />
          </Field>

          <Field label="Display Color" htmlFor="displayColor">
            <Select
              id="displayColor"
              value={v.displayColor}
              onChange={(e) => set("displayColor", e.target.value)}
            >
              {DISPLAY_COLORS.map((c) => (
                <option key={c} value={c}>
                  {c[0].toUpperCase() + c.slice(1)}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Status">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox
                checked={v.active}
                onChange={(e) => set("active", e.target.checked)}
              />
              Active
            </label>
          </Field>

          <Field label="Description" htmlFor="description" className="md:col-span-2">
            <Textarea
              id="description"
              rows={2}
              value={v.description}
              placeholder="Standard annual leave. Balance comes from approved allocations."
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection title="Behaviour">
        <div className="space-y-3">
          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-hover">
            <Checkbox
              className="mt-0.5"
              checked={v.requiresAllocation}
              onChange={(e) => set("requiresAllocation", e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Requires Allocation</span>
              <span className="block text-xs text-muted-foreground">
                An employee must hold an approved allocation with enough remaining before they
                can request this leave, and approving a request consumes that balance. Leave
                unticked for types like Sick Leave that are granted freely.
              </span>
            </span>
          </label>

          <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-hover">
            <Checkbox
              className="mt-0.5"
              checked={v.isPaid}
              onChange={(e) => set("isPaid", e.target.checked)}
            />
            <span>
              <span className="block text-sm font-medium">Paid leave</span>
              <span className="block text-xs text-muted-foreground">
                Unpaid types feed the unpaid-leave deduction when payroll is computed.
              </span>
            </span>
          </label>
        </div>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending} loadingText="Saving…">
          {v.id ? "Save Changes" : "Create Type"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/time-off/types")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
