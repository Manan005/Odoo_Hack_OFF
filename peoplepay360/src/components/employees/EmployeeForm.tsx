"use client"

import { EmployeeType, Gender } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createEmployee, updateEmployee } from "@/actions/employee.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Input, Select, Textarea } from "@/components/ui/field"
import { UnderlineTabs } from "@/components/ui/tabs"
import { EMPLOYEE_TYPE_LABEL, GENDER_LABEL } from "@/lib/validation/employee"

export interface Option {
  id: string
  name: string
}

export interface EmployeeFormValues {
  id?: string
  firstName: string
  lastName: string
  workEmail: string
  workPhone: string
  employeeType: EmployeeType
  workLocation: string
  departmentId: string
  jobPositionId: string
  managerId: string
  workingScheduleId: string
  active: boolean
  personalEmail: string
  personalPhone: string
  dateOfBirth: string
  gender: Gender | ""
  address: string
  emergencyContactName: string
  emergencyContactPhone: string
  bankAccountNumber: string
  bankName: string
  bankIfsc: string
  joiningDate: string
  employeeCode?: string
}

const TABS = ["Work Information", "Private Information", "HR Settings"] as const
type Tab = (typeof TABS)[number]

export function EmployeeForm({
  initial,
  departments,
  positions,
  managers,
  schedules,
  readOnly = false,
}: {
  initial: EmployeeFormValues
  departments: Option[]
  positions: Option[]
  managers: Option[]
  schedules: Option[]
  readOnly?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [tab, setTab] = useState<Tab>("Work Information")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<EmployeeFormValues>(initial)

  const set = <K extends keyof EmployeeFormValues>(key: K, value: EmployeeFormValues[K]) =>
    setV((prev) => ({ ...prev, [key]: value }))

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const payload = {
        ...v,
        gender: v.gender === "" ? null : v.gender,
        departmentId: v.departmentId,
        jobPositionId: v.jobPositionId,
        managerId: v.managerId,
        workingScheduleId: v.workingScheduleId,
      }
      const result = v.id
        ? await updateEmployee({ ...payload, id: v.id })
        : await createEmployee(payload)

      if (result.ok) {
        toast.success(v.id ? "Employee updated." : "Employee created.")
        router.push(`/employees/${result.data.id}`)
        router.refresh()
        return
      }
      setErrors(result.fieldErrors ?? {})
      toast.error(result.message)
      // Surface the tab holding the first error so it is not hidden.
      const keys = Object.keys(result.fieldErrors ?? {})
      if (keys.some((k) => PRIVATE_FIELDS.has(k))) setTab("Private Information")
    })
  }

  return (
    <div className="space-y-5">
      <UnderlineTabs tabs={TABS} value={tab} onChange={setTab} />

      {tab === "Work Information" && (
        <FormSection key="work" className="animate-fade-in">
          <FieldGrid>
            <Field label="First Name" htmlFor="firstName" required error={errors.firstName}>
              <Input
                id="firstName"
                value={v.firstName}
                disabled={readOnly}
                error={Boolean(errors.firstName)}
                onChange={(e) => set("firstName", e.target.value)}
              />
            </Field>
            <Field label="Last Name" htmlFor="lastName" required error={errors.lastName}>
              <Input
                id="lastName"
                value={v.lastName}
                disabled={readOnly}
                error={Boolean(errors.lastName)}
                onChange={(e) => set("lastName", e.target.value)}
              />
            </Field>
            <Field label="Work Email" htmlFor="workEmail" error={errors.workEmail}>
              <Input
                id="workEmail"
                type="email"
                value={v.workEmail}
                disabled={readOnly}
                error={Boolean(errors.workEmail)}
                onChange={(e) => set("workEmail", e.target.value)}
              />
            </Field>
            <Field label="Work Phone" htmlFor="workPhone">
              <Input
                id="workPhone"
                value={v.workPhone}
                disabled={readOnly}
                onChange={(e) => set("workPhone", e.target.value)}
              />
            </Field>
            <Field label="Department" htmlFor="departmentId">
              <Select
                id="departmentId"
                value={v.departmentId}
                disabled={readOnly}
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
                disabled={readOnly}
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
            <Field label="Manager" htmlFor="managerId" error={errors.managerId}>
              <Select
                id="managerId"
                value={v.managerId}
                disabled={readOnly}
                error={Boolean(errors.managerId)}
                onChange={(e) => set("managerId", e.target.value)}
              >
                <option value="">—</option>
                {managers
                  .filter((m) => m.id !== v.id)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
              </Select>
            </Field>
            <Field label="Work Location" htmlFor="workLocation">
              <Input
                id="workLocation"
                value={v.workLocation}
                disabled={readOnly}
                onChange={(e) => set("workLocation", e.target.value)}
              />
            </Field>
            <Field
              label="Working Schedule"
              htmlFor="workingScheduleId"
              hint="Drives expected hours for attendance and payroll."
            >
              <Select
                id="workingScheduleId"
                value={v.workingScheduleId}
                disabled={readOnly}
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
            <Field label="Employee Type" htmlFor="employeeType">
              <Select
                id="employeeType"
                value={v.employeeType}
                disabled={readOnly}
                onChange={(e) => set("employeeType", e.target.value as EmployeeType)}
              >
                {Object.values(EmployeeType).map((t) => (
                  <option key={t} value={t}>
                    {EMPLOYEE_TYPE_LABEL[t]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Status">
              <label className="flex h-9 items-center gap-2 text-sm">
                <Checkbox
                  checked={v.active}
                  disabled={readOnly}
                  onChange={(e) => set("active", e.target.checked)}
                />
                Active
              </label>
            </Field>
          </FieldGrid>
        </FormSection>
      )}

      {tab === "Private Information" && (
        <div key="private" className="stagger space-y-5">
          <FormSection title="Personal">
            <FieldGrid>
              <Field label="Personal Email" htmlFor="personalEmail" error={errors.personalEmail}>
                <Input
                  id="personalEmail"
                  type="email"
                  value={v.personalEmail}
                  disabled={readOnly}
                  error={Boolean(errors.personalEmail)}
                  onChange={(e) => set("personalEmail", e.target.value)}
                />
              </Field>
              <Field label="Personal Phone" htmlFor="personalPhone">
                <Input
                  id="personalPhone"
                  value={v.personalPhone}
                  disabled={readOnly}
                  onChange={(e) => set("personalPhone", e.target.value)}
                />
              </Field>
              <Field label="Date of Birth" htmlFor="dateOfBirth">
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={v.dateOfBirth}
                  disabled={readOnly}
                  onChange={(e) => set("dateOfBirth", e.target.value)}
                />
              </Field>
              <Field label="Gender" htmlFor="gender">
                <Select
                  id="gender"
                  value={v.gender}
                  disabled={readOnly}
                  onChange={(e) => set("gender", e.target.value as Gender | "")}
                >
                  <option value="">—</option>
                  {Object.values(Gender).map((g) => (
                    <option key={g} value={g}>
                      {GENDER_LABEL[g]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Address" htmlFor="address" className="md:col-span-2">
                <Textarea
                  id="address"
                  rows={2}
                  value={v.address}
                  disabled={readOnly}
                  onChange={(e) => set("address", e.target.value)}
                />
              </Field>
              <Field label="Emergency Contact Name" htmlFor="emergencyContactName">
                <Input
                  id="emergencyContactName"
                  value={v.emergencyContactName}
                  disabled={readOnly}
                  onChange={(e) => set("emergencyContactName", e.target.value)}
                />
              </Field>
              <Field label="Emergency Contact Phone" htmlFor="emergencyContactPhone">
                <Input
                  id="emergencyContactPhone"
                  value={v.emergencyContactPhone}
                  disabled={readOnly}
                  onChange={(e) => set("emergencyContactPhone", e.target.value)}
                />
              </Field>
            </FieldGrid>
          </FormSection>

          <FormSection
            title="Bank details"
            description="Missing bank details raise a payroll warning when a payrun is computed."
          >
            <FieldGrid>
              <Field label="Bank Account Number" htmlFor="bankAccountNumber">
                <Input
                  id="bankAccountNumber"
                  value={v.bankAccountNumber}
                  disabled={readOnly}
                  onChange={(e) => set("bankAccountNumber", e.target.value)}
                />
              </Field>
              <Field label="Bank Name" htmlFor="bankName">
                <Input
                  id="bankName"
                  value={v.bankName}
                  disabled={readOnly}
                  onChange={(e) => set("bankName", e.target.value)}
                />
              </Field>
              <Field label="IFSC" htmlFor="bankIfsc">
                <Input
                  id="bankIfsc"
                  value={v.bankIfsc}
                  disabled={readOnly}
                  onChange={(e) => set("bankIfsc", e.target.value)}
                />
              </Field>
            </FieldGrid>
          </FormSection>
        </div>
      )}

      {tab === "HR Settings" && (
        <FormSection key="hr" className="animate-fade-in">
          <FieldGrid>
            <Field label="Employee Code" hint="Assigned automatically.">
              <div className="flex h-9 items-center rounded-lg border border-dashed border-border bg-surface-muted/60 px-3 font-mono text-[13px]">
                {v.employeeCode ?? "assigned on save"}
              </div>
            </Field>
            <Field label="Joining Date" htmlFor="joiningDate">
              <Input
                id="joiningDate"
                type="date"
                value={v.joiningDate}
                disabled={readOnly}
                onChange={(e) => set("joiningDate", e.target.value)}
              />
            </Field>
          </FieldGrid>
        </FormSection>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2">
          <Button onClick={submit} loading={pending} loadingText="Saving…">
            {v.id ? "Save Changes" : "Create Employee"}
          </Button>
          <Button variant="ghost" onClick={() => router.back()} disabled={pending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}

const PRIVATE_FIELDS = new Set([
  "personalEmail",
  "personalPhone",
  "dateOfBirth",
  "gender",
  "address",
  "emergencyContactName",
  "emergencyContactPhone",
  "bankAccountNumber",
  "bankName",
  "bankIfsc",
])
