"use client"

import { ComputationType, PercentageBase, RuleCategory } from "@prisma/client"
import { Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveRule } from "@/actions/salary.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field"
import {
  BASE_LABEL,
  CATEGORY_LABEL,
  COMPUTATION_LABEL,
} from "@/lib/validation/payroll"

export interface RuleFormValues {
  id?: string
  structureId: string
  name: string
  code: string
  category: RuleCategory
  sequence: string
  computationType: ComputationType
  amount: string
  percentage: string
  percentageBase: PercentageBase | ""
  baseRuleCode: string
  formula: string
  quantity: string
  condition: string
  active: boolean
}

const CONTEXT_FACTS = [
  "wage",
  "scheduledDays",
  "workedDays",
  "absentDays",
  "paidLeaveDays",
  "unpaidLeaveDays",
  "workedHours",
  "overtimeHours",
  "hoursPerWeek",
  "hourlyRate",
  "perDayRate",
]

export function SalaryRuleForm({
  initial,
  structures,
  siblingCodes,
  readOnly = false,
}: {
  initial: RuleFormValues
  structures: Array<{ id: string; name: string }>
  siblingCodes: string[]
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [v, setV] = useState<RuleFormValues>(initial)

  const set = <K extends keyof RuleFormValues>(k: K, value: RuleFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  const submit = () => {
    setErrors({})
    setFormError(null)
    startTransition(async () => {
      const result = await saveRule({
        ...v,
        id: v.id,
        percentageBase: v.percentageBase === "" ? null : v.percentageBase,
      })
      if (result.ok) {
        toast.success("Salary rule saved. Recompute a payrun to see it applied.")
        router.push(`/payroll/rules/${result.data.id}`)
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

      <FormSection title="Rule">
        <FieldGrid>
          <Field label="Rule Name" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              value={v.name}
              placeholder="House Rent Allowance"
              disabled={readOnly}
              error={Boolean(errors.name)}
              onChange={(e) => set("name", e.target.value)}
            />
          </Field>

          <Field
            label="Code"
            htmlFor="code"
            required
            error={errors.code}
            hint="Uppercase. Other rules reference this in formulas."
          >
            <Input
              id="code"
              value={v.code}
              placeholder="HRA"
              className="font-mono"
              disabled={readOnly}
              error={Boolean(errors.code)}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
            />
          </Field>

          <Field label="Salary Structure" htmlFor="structureId" required error={errors.structureId}>
            <Select
              id="structureId"
              value={v.structureId}
              disabled={readOnly}
              error={Boolean(errors.structureId)}
              onChange={(e) => set("structureId", e.target.value)}
            >
              <option value="">Select structure</option>
              {structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Category" htmlFor="category">
            <Select
              id="category"
              value={v.category}
              disabled={readOnly}
              onChange={(e) => set("category", e.target.value as RuleCategory)}
            >
              {Object.values(RuleCategory).map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>

          <Field
            label="Sequence"
            htmlFor="sequence"
            required
            error={errors.sequence}
            hint="Lower runs first. Gross and Net must run after what they sum."
          >
            <Input
              id="sequence"
              type="number"
              min={1}
              value={v.sequence}
              className="text-right tabular"
              disabled={readOnly}
              error={Boolean(errors.sequence)}
              onChange={(e) => set("sequence", e.target.value)}
            />
          </Field>

          <Field label="Quantity" htmlFor="quantity" error={errors.quantity} hint="Multiplier, usually 1.">
            <Input
              id="quantity"
              inputMode="decimal"
              value={v.quantity}
              className="text-right tabular"
              disabled={readOnly}
              error={Boolean(errors.quantity)}
              onChange={(e) => set("quantity", e.target.value)}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection title="Computation">
        <FieldGrid>
          <Field label="Method" htmlFor="computationType">
            <Select
              id="computationType"
              value={v.computationType}
              disabled={readOnly}
              onChange={(e) => set("computationType", e.target.value as ComputationType)}
            >
              {Object.values(ComputationType).map((c) => (
                <option key={c} value={c}>
                  {COMPUTATION_LABEL[c]}
                </option>
              ))}
            </Select>
          </Field>

          {v.computationType === ComputationType.FIXED && (
            <Field label="Amount" htmlFor="amount" required error={errors.amount}>
              <Input
                id="amount"
                inputMode="decimal"
                value={v.amount}
                placeholder="3000"
                className="text-right tabular"
                disabled={readOnly}
                error={Boolean(errors.amount)}
                onChange={(e) => set("amount", e.target.value)}
              />
            </Field>
          )}

          {v.computationType === ComputationType.PERCENTAGE && (
            <>
              <Field label="Percentage" htmlFor="percentage" required error={errors.percentage}>
                <Input
                  id="percentage"
                  inputMode="decimal"
                  value={v.percentage}
                  placeholder="20"
                  className="text-right tabular"
                  disabled={readOnly}
                  error={Boolean(errors.percentage)}
                  onChange={(e) => set("percentage", e.target.value)}
                />
              </Field>
              <Field label="Percentage Of" htmlFor="percentageBase">
                <Select
                  id="percentageBase"
                  value={v.percentageBase}
                  disabled={readOnly}
                  onChange={(e) =>
                    set("percentageBase", e.target.value as PercentageBase | "")
                  }
                >
                  {Object.values(PercentageBase).map((b) => (
                    <option key={b} value={b}>
                      {BASE_LABEL[b]}
                    </option>
                  ))}
                </Select>
              </Field>
              {v.percentageBase === PercentageBase.RULE_CODE && (
                <Field
                  label="Base Rule Code"
                  htmlFor="baseRuleCode"
                  required
                  error={errors.baseRuleCode}
                  hint={
                    siblingCodes.length > 0
                      ? `Available: ${siblingCodes.join(", ")}`
                      : "No other rules in this structure yet."
                  }
                >
                  <Input
                    id="baseRuleCode"
                    value={v.baseRuleCode}
                    className="font-mono"
                    disabled={readOnly}
                    error={Boolean(errors.baseRuleCode)}
                    onChange={(e) => set("baseRuleCode", e.target.value.toUpperCase())}
                  />
                </Field>
              )}
            </>
          )}

          {v.computationType === ComputationType.FORMULA && (
            <Field
              label="Formula"
              htmlFor="formula"
              required
              error={errors.formula}
              className="md:col-span-2"
            >
              <Textarea
                id="formula"
                rows={2}
                value={v.formula}
                placeholder="BASIC + HRA + STD"
                className="font-mono text-[13px]"
                disabled={readOnly}
                error={Boolean(errors.formula)}
                onChange={(e) => set("formula", e.target.value)}
              />
            </Field>
          )}

          <Field
            label="Condition"
            htmlFor="condition"
            error={errors.condition}
            className="md:col-span-2"
            hint="Optional. The rule applies only when this is true, e.g. workedDays < scheduledDays"
          >
            <Input
              id="condition"
              value={v.condition}
              className="font-mono text-[13px]"
              disabled={readOnly}
              error={Boolean(errors.condition)}
              onChange={(e) => set("condition", e.target.value)}
            />
          </Field>

          <Field label="Status">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox
                checked={v.active}
                disabled={readOnly}
                onChange={(e) => set("active", e.target.checked)}
              />
              Active — inactive rules are skipped when computing
            </label>
          </Field>
        </FieldGrid>

        {(v.computationType === ComputationType.FORMULA || v.condition) && (
          <div className="mt-4 rounded-md bg-info-subtle p-3 text-xs text-info">
            <p className="mb-1.5 flex items-center gap-1.5 font-medium">
              <Info className="h-3.5 w-3.5" />
              What a formula can reference
            </p>
            <p className="mb-1">
              <span className="font-medium">Rule codes in this structure:</span>{" "}
              <span className="font-mono">
                {siblingCodes.length > 0 ? siblingCodes.join(", ") : "none yet"}
              </span>{" "}
              — only those with a lower sequence will have a value.
            </p>
            <p className="mb-1">
              <span className="font-medium">Context facts:</span>{" "}
              <span className="font-mono">{CONTEXT_FACTS.join(", ")}</span>
            </p>
            <p>
              <span className="font-medium">Functions:</span>{" "}
              <span className="font-mono">min, max, round, abs, floor, ceil, if</span>
            </p>
          </div>
        )}
      </FormSection>

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={submit} loading={pending} loadingText="Saving…">
            {v.id ? "Save Changes" : "Create Rule"}
          </Button>
          <Button
            variant="ghost"
            onClick={() => router.push("/payroll/rules")}
            disabled={pending}
          >
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
