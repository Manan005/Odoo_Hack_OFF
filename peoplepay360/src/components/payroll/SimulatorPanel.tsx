"use client"

import { RuleCategory } from "@prisma/client"
import { FlaskConical, Info, RotateCcw } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { runSimulation, type SimulationResult } from "@/actions/simulator.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/field"
import { formatINR } from "@/lib/money"
import type { SimulatorOptions } from "@/lib/payroll/simulator"
import { cn } from "@/lib/utils"

interface Values {
  employeeId: string
  structureId: string
  period: string
  wage: string
  workedDays: string
  overtimeHours: string
  unpaidLeaveDays: string
}

const OVERRIDE_KEYS = ["wage", "workedDays", "overtimeHours", "unpaidLeaveDays"] as const

const signed = (v: string) => (Number(v) > 0 ? `+${formatINR(v)}` : formatINR(v))

const deltaTone = (v: string, invert = false) => {
  const n = Number(v)
  if (n === 0) return "text-muted-foreground"
  const good = invert ? n < 0 : n > 0
  return good ? "text-success" : "text-danger"
}

export function SimulatorPanel({
  options,
  defaults,
  initial,
}: {
  options: SimulatorOptions
  defaults: { employeeId: string; structureId: string; period: string }
  /** Baseline computed on the server, so the page opens already populated. */
  initial: SimulationResult | null
}) {
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [result, setResult] = useState<SimulationResult | null>(initial)

  const [v, setV] = useState<Values>({
    ...defaults,
    wage: "",
    workedDays: "",
    overtimeHours: "",
    unpaidLeaveDays: "",
  })

  const set = <K extends keyof Values>(k: K, value: Values[K]) =>
    setV((prev) => ({ ...prev, [k]: value }))

  const hasOverride = OVERRIDE_KEYS.some((k) => v[k].trim() !== "")

  const run = () => {
    const [periodStart, periodEnd] = v.period.split("|")
    setErrors({})
    startTransition(async () => {
      const res = await runSimulation({
        employeeId: v.employeeId,
        structureId: v.structureId,
        periodStart,
        periodEnd,
        wage: v.wage,
        workedDays: v.workedDays,
        overtimeHours: v.overtimeHours,
        unpaidLeaveDays: v.unpaidLeaveDays,
      })
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {})
        setResult(null)
        toast.error(res.message)
        return
      }
      setResult(res.data)
    })
  }

  const resetOverrides = () => {
    setV((prev) => ({
      ...prev,
      wage: "",
      workedDays: "",
      overtimeHours: "",
      unpaidLeaveDays: "",
    }))
  }

  const earnings =
    result?.lines.filter(
      (l) => l.category === RuleCategory.BASIC || l.category === RuleCategory.ALLOWANCE,
    ) ?? []
  const deductions = result?.lines.filter((l) => l.category === RuleCategory.DEDUCTION) ?? []

  return (
    <div className="space-y-5">
      <FormSection title="Scenario">
        <FieldGrid>
          <Field label="Employee" htmlFor="employeeId" error={errors.employeeId}>
            <Select
              id="employeeId"
              value={v.employeeId}
              onChange={(e) => set("employeeId", e.target.value)}
            >
              {options.employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} · {e.employeeCode}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Salary Structure" htmlFor="structureId" error={errors.structureId}>
            <Select
              id="structureId"
              value={v.structureId}
              onChange={(e) => set("structureId", e.target.value)}
            >
              {options.structures.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
          </Field>

          <Field label="Period" htmlFor="period" error={errors.periodEnd}>
            <Select id="period" value={v.period} onChange={(e) => set("period", e.target.value)}>
              {options.periods.map((p) => (
                <option key={p.start} value={`${p.start}|${p.end}`}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection title="Overrides">
        <p className="mb-4 flex items-start gap-2 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Leave a field blank to use the employee&apos;s real figure. With every field blank the
          simulation reproduces the stored payslip exactly — it is the same engine.
        </p>
        <FieldGrid>
          <Field
            label="Contract Wage"
            htmlFor="wage"
            error={errors.wage}
            hint={result?.contract ? `actual ${formatINR(result.contract.wage)}` : undefined}
          >
            <Input
              id="wage"
              inputMode="decimal"
              placeholder={result?.contract?.wage ?? "actual"}
              value={v.wage}
              error={Boolean(errors.wage)}
              onChange={(e) => set("wage", e.target.value)}
            />
          </Field>

          <Field
            label="Worked Days"
            htmlFor="workedDays"
            error={errors.workedDays}
            hint={result ? `actual ${result.facts["Worked days"]}` : undefined}
          >
            <Input
              id="workedDays"
              inputMode="decimal"
              placeholder="actual"
              value={v.workedDays}
              error={Boolean(errors.workedDays)}
              onChange={(e) => set("workedDays", e.target.value)}
            />
          </Field>

          <Field
            label="Overtime Hours"
            htmlFor="overtimeHours"
            error={errors.overtimeHours}
            hint={result ? `actual ${result.facts["Overtime hours"]}` : undefined}
          >
            <Input
              id="overtimeHours"
              inputMode="decimal"
              placeholder="actual"
              value={v.overtimeHours}
              error={Boolean(errors.overtimeHours)}
              onChange={(e) => set("overtimeHours", e.target.value)}
            />
          </Field>

          <Field
            label="Unpaid Leave Days"
            htmlFor="unpaidLeaveDays"
            error={errors.unpaidLeaveDays}
            hint={result ? `actual ${result.facts["Unpaid leave days"]}` : undefined}
          >
            <Input
              id="unpaidLeaveDays"
              inputMode="decimal"
              placeholder="actual"
              value={v.unpaidLeaveDays}
              error={Boolean(errors.unpaidLeaveDays)}
              onChange={(e) => set("unpaidLeaveDays", e.target.value)}
            />
          </Field>
        </FieldGrid>

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={run} loading={pending} loadingText="Computing…">
            <FlaskConical className="h-4 w-4" />
            RUN SIMULATION
          </Button>
          <Button variant="ghost" onClick={resetOverrides} disabled={pending || !hasOverride}>
            <RotateCcw className="h-4 w-4" />
            Reset overrides
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Nothing is saved. No payslip, payrun or contract is touched.
          </span>
        </div>
      </FormSection>

      {result && (
        <>
          {result.matchesStored && !hasOverride && (
            <p className="rounded-md border-l-2 border-success bg-success-subtle px-4 py-3 text-xs text-success">
              Baseline verified — with no overrides this reproduces {result.actual?.reference}{" "}
              exactly, to the paisa. Every number below therefore comes from the same engine
              payroll runs.
            </p>
          )}

          {result.changed.length > 0 && (
            <div className="rounded-lg border border-border bg-surface p-5 shadow-card">
              <h3 className="mb-3 text-sm font-semibold">What you changed</h3>
              <ul className="space-y-1.5">
                {result.changed.map((c) => (
                  <li key={c.label} className="flex items-center gap-2 text-sm">
                    <span className="w-40 text-muted-foreground">{c.label}</span>
                    <span className="tabular text-muted-foreground line-through">{c.from}</span>
                    <span className="text-muted-foreground">→</span>
                    <span className="tabular font-medium text-primary">{c.to}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-border bg-surface shadow-card">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border px-5 py-4">
              <h3 className="text-sm font-semibold">
                {result.employeeName} · {result.structureName}
              </h3>
              <p className="text-xs text-muted-foreground">
                {result.contract && (
                  <>
                    contract <span className="font-mono">{result.contract.reference}</span> ·{" "}
                  </>
                )}
                {result.periodLabel}
                {result.actual && (
                  <>
                    {" "}
                    · compared with <span className="font-mono">{result.actual.reference}</span>
                  </>
                )}
              </p>
            </header>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-medium">Rule</th>
                    <th className="px-5 py-2.5 text-right font-medium">Actual</th>
                    <th className="px-5 py-2.5 text-right font-medium">Simulated</th>
                    <th className="px-5 py-2.5 text-right font-medium">Delta</th>
                  </tr>
                </thead>

                <SimBody title="Earnings" lines={earnings} />
                <SimBody title="Deductions" lines={deductions} invert />

                <tfoot>
                  <TotalRow
                    label="Gross"
                    actual={result.actual?.gross ?? null}
                    simulated={result.simulated.gross}
                    delta={result.deltas?.gross ?? null}
                  />
                  <TotalRow
                    label="Total Deductions"
                    actual={result.actual?.deductions ?? null}
                    simulated={result.simulated.deductions}
                    delta={result.deltas?.deductions ?? null}
                    invert
                  />
                  <TotalRow
                    label="Net Salary"
                    actual={result.actual?.net ?? null}
                    simulated={result.simulated.net}
                    delta={result.deltas?.net ?? null}
                    emphasis
                  />
                </tfoot>
              </table>
            </div>
          </div>

          <details className="rounded-lg border border-border bg-surface p-5 shadow-card">
            <summary className="cursor-pointer text-sm font-semibold">
              Facts fed to the engine
            </summary>
            <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
              {Object.entries(result.facts).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </dt>
                  <dd className="mt-1 text-sm font-medium tabular">{value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </>
      )}
    </div>
  )
}

function SimBody({
  title,
  lines,
  invert = false,
}: {
  title: string
  lines: SimulationResult["lines"]
  invert?: boolean
}) {
  if (lines.length === 0) return null
  return (
    <tbody>
      <tr className="bg-surface-muted">
        <td
          colSpan={4}
          className="px-5 py-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"
        >
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr key={l.code} className="border-b border-border/60">
          <td className="px-5 py-2.5">
            <span className="font-medium">{l.name}</span>
            <span className="ml-2 font-mono text-[11px] text-subtle-foreground">{l.code}</span>
          </td>
          <td className="px-5 py-2.5 text-right tabular text-muted-foreground">
            {l.actual ? formatINR(l.actual) : "—"}
          </td>
          <td className="px-5 py-2.5 text-right tabular font-medium">
            {l.simulated ? formatINR(l.simulated) : "—"}
          </td>
          <td
            className={cn(
              "px-5 py-2.5 text-right tabular",
              l.delta ? deltaTone(l.delta, invert) : "text-muted-foreground",
            )}
          >
            {l.delta === null ? "—" : Number(l.delta) === 0 ? "—" : signed(l.delta)}
          </td>
        </tr>
      ))}
    </tbody>
  )
}

function TotalRow({
  label,
  actual,
  simulated,
  delta,
  invert = false,
  emphasis = false,
}: {
  label: string
  actual: string | null
  simulated: string
  delta: string | null
  invert?: boolean
  emphasis?: boolean
}) {
  return (
    <tr className={cn("border-t border-border", emphasis && "bg-primary-subtle")}>
      <td className={cn("px-5 py-3 font-semibold", emphasis && "text-primary")}>{label}</td>
      <td className="px-5 py-3 text-right tabular text-muted-foreground">
        {actual ? formatINR(actual) : "—"}
      </td>
      <td className={cn("px-5 py-3 text-right tabular font-semibold", emphasis && "text-primary")}>
        {formatINR(simulated)}
      </td>
      <td
        className={cn(
          "px-5 py-3 text-right tabular font-semibold",
          delta ? deltaTone(delta, invert) : "text-muted-foreground",
        )}
      >
        {delta === null ? "—" : Number(delta) === 0 ? "no change" : signed(delta)}
      </td>
    </tr>
  )
}
