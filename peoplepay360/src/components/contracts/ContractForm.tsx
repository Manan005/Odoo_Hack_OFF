"use client"

import { ContractStatus } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createContract, updateContract } from "@/actions/contract.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Field, Input, Select, Textarea } from "@/components/ui/field"
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

export const emptyContract: ContractFormValues = {
  employeeId: "",
  startDate: "",
  endDate: "",
  wage: "",
  status: ContractStatus.DRAFT,
  departmentId: "",
  jobPositionId: "",
  workingScheduleId: "",
  salaryStructureId: "",
  notes: "",
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
          className="rounded-md border border-danger bg-danger-subtle px-4 py-3 text-sm text-danger"
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
            <Input
              id="wage"
              inputMode="decimal"
              value={v.wage}
              placeholder="85000"
              className="text-right tabular"
              error={Boolean(errors.wage)}
              onChange={(e) => set("wage", e.target.value)}
            />
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
          {v.id ? "Save Changes" : "Create Contract"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/contracts")} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
