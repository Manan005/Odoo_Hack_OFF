"use client"

import { AttendanceStatus } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { saveAttendance } from "@/actions/attendance.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Field, Input, ReadOnlyValue, Select, Textarea } from "@/components/ui/field"
import {
  ATTENDANCE_STATUS_LABEL,
  computeOvertime,
  computeWorkedHours,
  type ScheduleLineLike,
} from "@/lib/attendance/compute"
import { formatHours } from "@/lib/money"

export interface AttendanceFormValues {
  id?: string
  employeeId: string
  checkIn: string
  checkOut: string
  status: AttendanceStatus
  notes: string
}

export const emptyAttendance: AttendanceFormValues = {
  employeeId: "",
  checkIn: "",
  checkOut: "",
  status: AttendanceStatus.PRESENT,
  notes: "",
}

export function AttendanceForm({
  initial,
  employees,
  scheduleLines,
  canEdit,
  audit,
}: {
  initial: AttendanceFormValues
  employees: Array<{ id: string; name: string }>
  scheduleLines: ScheduleLineLike[]
  canEdit: boolean
  audit?: { editedAt: Date | null; editedBy: string | null }
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<AttendanceFormValues>(initial)

  const set = <K extends keyof AttendanceFormValues>(k: K, value: AttendanceFormValues[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  // Preview only — the server recomputes these and its answer wins.
  const derived = useMemo(() => {
    if (!v.checkIn) return { workedHours: 0, overtime: 0 }
    const inAt = new Date(v.checkIn)
    const outAt = v.checkOut ? new Date(v.checkOut) : null
    if (Number.isNaN(inAt.getTime())) return { workedHours: 0, overtime: 0 }
    const line = scheduleLines.find(
      (l) =>
        l.day ===
        (["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"] as const)[
          inAt.getDay()
        ],
    )
    const workedHours = computeWorkedHours(inAt, outAt)
    return { workedHours, overtime: computeOvertime(workedHours, line ?? null) }
  }, [v.checkIn, v.checkOut, scheduleLines])

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const result = await saveAttendance(v.id ? { ...v, id: v.id } : v)
      if (result.ok) {
        toast.success(v.id ? "Attendance updated." : "Attendance recorded.")
        router.push(`/attendance/${result.data.id}`)
        router.refresh()
        return
      }
      setErrors(result.fieldErrors ?? {})
      toast.error(result.message)
    })
  }

  return (
    <div className="space-y-5">
      {v.id && !canEdit && (
        <p className="rounded-md bg-warning-subtle px-4 py-3 text-xs text-warning">
          Attendance corrections are restricted to HR. This record is read-only for you.
        </p>
      )}

      <FormSection title="Attendance record">
        <FieldGrid>
          <Field label="Employee" htmlFor="employeeId" required error={errors.employeeId}>
            <Select
              id="employeeId"
              value={v.employeeId}
              disabled={!canEdit || employees.length <= 1}
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
              disabled={!canEdit}
              onChange={(e) => set("status", e.target.value as AttendanceStatus)}
            >
              {Object.values(AttendanceStatus).map((s) => (
                <option key={s} value={s}>
                  {ATTENDANCE_STATUS_LABEL[s]}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Check In" htmlFor="checkIn" required error={errors.checkIn}>
            <Input
              id="checkIn"
              type="datetime-local"
              value={v.checkIn}
              disabled={!canEdit}
              error={Boolean(errors.checkIn)}
              onChange={(e) => set("checkIn", e.target.value)}
            />
          </Field>

          <Field
            label="Check Out"
            htmlFor="checkOut"
            error={errors.checkOut}
            hint="Leave blank for a missing check-out — it is flagged, not guessed."
          >
            <Input
              id="checkOut"
              type="datetime-local"
              value={v.checkOut}
              disabled={!canEdit}
              error={Boolean(errors.checkOut)}
              onChange={(e) => set("checkOut", e.target.value)}
            />
          </Field>

          {/* Derived — recomputed server-side on every save (BR-A1, BR-A2). */}
          <ReadOnlyValue label="Worked Hours" value={formatHours(derived.workedHours)} />
          <ReadOnlyValue label="Overtime" value={`${formatHours(derived.overtime)} hrs`} />

          <Field label="Notes" htmlFor="notes" className="md:col-span-2">
            <Textarea
              id="notes"
              rows={2}
              value={v.notes}
              disabled={!canEdit}
              onChange={(e) => set("notes", e.target.value)}
            />
          </Field>
        </FieldGrid>

        <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
          System-generated from check in/out, or manually corrected by an authorized user.
          {audit?.editedAt && (
            <>
              {" "}
              Last corrected {audit.editedAt.toLocaleString()}
              {audit.editedBy ? ` by ${audit.editedBy}` : ""}.
            </>
          )}
        </p>
      </FormSection>

      {canEdit && (
        <div className="flex items-center gap-2">
          <Button onClick={submit} loading={pending} loadingText="Saving…">
            {v.id ? "Save Changes" : "Record Attendance"}
          </Button>
          <Button variant="ghost" onClick={() => router.push("/attendance")} disabled={pending}>
            Cancel
          </Button>
        </div>
      )}
    </div>
  )
}
