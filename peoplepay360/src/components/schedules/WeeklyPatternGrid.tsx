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
import { NumberTicker } from "@/components/ui/number-ticker"
import {
  WEEKDAY_LABEL,
  WEEKDAY_ORDER,
  deriveLineHours,
  deriveWeeklyTotals,
  formatWeeklyHours,
  sortLines,
} from "@/lib/schedule/hours"
import { cn } from "@/lib/utils"

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

const DEFAULT_LINE = { startTime: "09:00", endTime: "18:00", breakHours: 1 }

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

  const addDay = (day?: Weekday) => {
    const target = day ?? freeDays[0]
    if (!target || usedDays.has(target)) return
    setV((prev) => ({
      ...prev,
      lines: sortLines([...prev.lines, { day: target, ...DEFAULT_LINE }]),
    }))
  }

  const removeDay = (day: Weekday) =>
    setV((prev) => ({ ...prev, lines: prev.lines.filter((l) => l.day !== day) }))

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

  const weeklyHours = formatWeeklyHours(totals.hoursPerWeek)

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
          <ReadOnlyValue
            label="Days per Week"
            value={<NumberTicker value={String(totals.daysPerWeek)} />}
          />
          <ReadOnlyValue label="Hours per Week" value={<NumberTicker value={weeklyHours} />} />
        </FieldGrid>
      </FormSection>

      <FormSection>
        <div className="mb-4 flex items-center justify-between border-b border-border/70 pb-3">
          <div>
            <h2 className="text-[15px] font-semibold tracking-tight">Weekly Schedule</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Tap a day to add or remove it, then set its hours below.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => addDay()}
            disabled={freeDays.length === 0}
            title={freeDays.length === 0 ? "Every weekday is already scheduled" : undefined}
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Add day
          </Button>
        </div>

        {/* Day cells: press feedback and a toggled-state transition. */}
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Working days">
          {WEEKDAY_ORDER.map((d) => {
            const on = usedDays.has(d)
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                onClick={() => (on ? removeDay(d) : addDay(d))}
                className={cn(
                  "day-cell inline-flex h-9 min-w-14 items-center justify-center rounded-lg px-3 text-xs font-semibold ring-1 ring-inset",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  on
                    ? "bg-primary text-primary-fg ring-primary shadow-primary"
                    : "bg-surface-muted text-muted-foreground ring-border/70 hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {WEEKDAY_LABEL[d].slice(0, 3)}
              </button>
            )
          })}
        </div>

        {errors.lines && (
          <p role="alert" className="mb-3 animate-fade-in text-xs text-danger">
            {errors.lines}
          </p>
        )}

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-border/70">
                {["Day", "Start Time", "End Time", "Break", "Hours", ""].map((h, i) => (
                  <th
                    key={h || i}
                    className={cn(
                      "px-3 py-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                      i >= 3 ? "text-right" : "text-left",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {v.lines.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No working days yet — tap a day above to add one.
                  </td>
                </tr>
              )}
              {v.lines.map((line, i) => {
                const hours = formatWeeklyHours(deriveLineHours(line))
                return (
                  <tr
                    key={line.day}
                    className="border-b border-border/60 transition-colors duration-100 last:border-0 hover:bg-surface-hover/50"
                  >
                    <td className="px-3 py-2">
                      <Select
                        value={line.day}
                        className="h-8 text-xs"
                        aria-label="Day"
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
                        aria-label="Start time"
                        onChange={(e) => setLine(i, { startTime: e.target.value })}
                      />
                    </td>
                    <td className="px-3 py-2">
                      <Input
                        type="time"
                        value={line.endTime}
                        className="h-8 text-xs"
                        aria-label="End time"
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
                        className="ml-auto h-8 w-20 text-right text-xs tabular"
                        aria-label="Break hours"
                        onChange={(e) => setLine(i, { breakHours: Number(e.target.value) })}
                      />
                    </td>
                    <td className="px-3 py-2 text-right text-sm font-medium tabular">
                      <span key={hours} className="settle inline-block">
                        {hours}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        aria-label={`Remove ${WEEKDAY_LABEL[line.day]}`}
                        onClick={() => removeDay(line.day)}
                        className="rounded-md p-1 text-muted-foreground transition-[background-color,color,transform] duration-150 hover:bg-danger-subtle hover:text-danger active:scale-90"
                      >
                        <X className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <div className="-mx-5 -mb-5 mt-4 flex items-center justify-between rounded-b-2xl border-t border-border/70 bg-surface-muted/60 px-5 py-3">
          <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Total weekly hours
          </span>
          <span className="flex items-baseline gap-2">
            <span className="text-xs text-muted-foreground tabular">
              {totals.daysPerWeek} {totals.daysPerWeek === 1 ? "day" : "days"}
            </span>
            <NumberTicker
              value={weeklyHours}
              className="font-display text-2xl font-semibold tracking-tight"
            />
          </span>
        </div>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending} loadingText="Saving…">
          {v.id ? "Save changes" : "Create schedule"}
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
