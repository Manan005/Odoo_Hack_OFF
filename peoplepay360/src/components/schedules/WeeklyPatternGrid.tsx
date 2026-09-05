"use client"

import { CalendarType, Weekday } from "@prisma/client"
import { Plus, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useMemo, useState, useTransition } from "react"
import { toast } from "sonner"
import { saveSchedule } from "@/actions/schedule.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Input, ReadOnlyValue, Select } from "@/components/ui/field"
import {
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  deriveLineHours,
  deriveWeeklyTotals,
  formatWeeklyHours,
  sortLines,
} from "@/lib/schedule/hours"

export interface LineValue {
  day: Weekday
  startTime: string
  endTime: string
  breakHours: number
}

export interface ScheduleFormValues {
  id?: string
  name: string
  calendarType: CalendarType
  timezone: string
  active: boolean
  lines: LineValue[]
}

export function ScheduleForm({ initial }: { initial: ScheduleFormValues }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<ScheduleFormValues>(initial)

  // BR-S1: totals are derived here for display and recomputed on the server.
  const totals = useMemo(() => deriveWeeklyTotals(v.lines), [v.lines])

  const usedDays = new Set(v.lines.map((l) => l.day))
  const freeDays = WEEKDAY_ORDER.filter((d) => !usedDays.has(d))

  const setLine = (index: number, patch: Partial<LineValue>) =>
    setV((prev) => ({
      ...prev,
      lines: prev.lines.map((l, i) => (i === index ? { ...l, ...patch } : l)),
    }))

  const addDay = () => {
    if (freeDays.length === 0) return
    setV((prev) => ({
      ...prev,
      lines: sortLines([
        ...prev.lines,
        { day: freeDays[0], startTime: "09:00", endTime: "18:00", breakHours: 1 },
      ]),
    }))
  }

  const removeDay = (index: number) =>
    setV((prev) => ({ ...prev, lines: prev.lines.filter((_, i) => i !== index) }))

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const result = await saveSchedule(v)
      if (result.ok) {
        toast.success(v.id ? "Schedule updated." : "Schedule created.")
        router.push(`/working-schedules/${result.data.id}`)
        router.refresh()
        return
      }
      setErrors(result.fieldErrors ?? {})
      toast.error(result.message)
    })
  }

  return (
    <div className="space-y-5">
      <FormSection>
        <FieldGrid>
          <Field label="Schedule Name" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              value={v.name}
              placeholder="40 Hours / Week"
              error={Boolean(errors.name)}
              onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
            />
          </Field>
          <Field label="Calendar Type" htmlFor="calendarType">
            <Select
              id="calendarType"
              value={v.calendarType}
              onChange={(e) =>
                setV((p) => ({ ...p, calendarType: e.target.value as CalendarType }))
              }
            >
              <option value={CalendarType.FIXED}>Fixed</option>
              <option value={CalendarType.VARIABLE}>Variable</option>
            </Select>
          </Field>
          <Field label="Timezone" htmlFor="timezone">
            <Input
              id="timezone"
              value={v.timezone}
              onChange={(e) => setV((p) => ({ ...p, timezone: e.target.value }))}
            />
          </Field>
          <Field label="Status">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox
                checked={v.active}
                onChange={(e) => setV((p) => ({ ...p, active: e.target.checked }))}
              />
              Active
            </label>
          </Field>

          {/* Derived — never editable (BR-S1). */}
          <ReadOnlyValue label="Days per Week" value={totals.daysPerWeek} />
          <ReadOnlyValue
            label="Hours per Week"
            value={formatWeeklyHours(totals.hoursPerWeek)}
          />
        </FieldGrid>
      </FormSection>

      <FormSection>
        <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-[15px] font-semibold">Weekly Schedule</h2>
          <Button
            variant="ghost"
            size="sm"
            onClick={addDay}
            disabled={freeDays.length === 0}
            title={freeDays.length === 0 ? "Every weekday is already scheduled" : undefined}
          >
            <Plus className="h-3.5 w-3.5" />
            Add Day
          </Button>
        </div>

        {errors.lines && <p className="mb-3 text-xs text-danger">{errors.lines}</p>}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border">
                {["Day", "Start Time", "End Time", "Break", "Hours", ""].map((h, i) => (
                  <th
                    key={h || i}
                    className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground ${
                      i >= 3 ? "text-right" : "text-left"
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {v.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No working days yet — add at least one.
                  </td>
                </tr>
              )}
              {v.lines.map((line, i) => (
                <tr key={line.day} className="border-b border-border last:border-0">
                  <td className="px-3 py-2">
                    <Select
                      value={line.day}
                      className="h-8 text-xs"
                      onChange={(e) => setLine(i, { day: e.target.value as Weekday })}
                    >
                      {WEEKDAY_ORDER.filter((d) => d === line.day || !usedDays.has(d)).map(
                        (d) => (
                          <option key={d} value={d}>
                            {WEEKDAY_LABEL[d]}
                          </option>
                        ),
                      )}
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="time"
                      value={line.startTime}
                      className="h-8 text-xs"
                      onChange={(e) => setLine(i, { startTime: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="time"
                      value={line.endTime}
                      className="h-8 text-xs"
                      error={line.endTime <= line.startTime}
                      onChange={(e) => setLine(i, { endTime: e.target.value })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <Input
                      type="number"
                      min={0}
                      step={0.25}
                      value={line.breakHours}
                      className="h-8 w-20 text-right text-xs tabular"
                      onChange={(e) => setLine(i, { breakHours: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-3 py-2 text-right text-sm font-medium tabular">
                    {formatWeeklyHours(deriveLineHours(line))}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${WEEKDAY_LABEL[line.day]}`}
                      onClick={() => removeDay(i)}
                      className="rounded p-1 text-muted-foreground hover:bg-danger-subtle hover:text-danger"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="-mx-5 -mb-5 mt-4 flex items-center justify-between border-t border-border bg-surface-muted px-5 py-3 text-sm font-semibold">
          <span>Total Weekly Hours:</span>
          <span className="tabular">{formatWeeklyHours(totals.hoursPerWeek)}</span>
        </div>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending} loadingText="Saving…">
          Save
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/working-schedules")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
