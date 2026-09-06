"use client"

import { RuleCategory } from "@prisma/client"
import { ArrowDownRight, ArrowUpRight, FlaskConical, Info, Minus, RotateCcw } from "lucide-react"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { runSimulation, type SimulationResult } from "@/actions/simulator.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/field"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Skeleton } from "@/components/ui/skeleton"
import { Surface } from "@/components/ui/surface"
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

const eyebrow = "text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

/**
 * Sign of a server-formatted decimal string. String inspection only — the
 * figure is never converted to a number here (rules.md §3); the server
 * already did the subtraction.
 */
const signOf = (v: string): -1 | 0 | 1 => {
  const t = v.trim()
  if (/^-?0+(\.0+)?$/.test(t)) return 0
  return t.startsWith("-") ? -1 : 1
}

const signed = (v: string) => (signOf(v) > 0 ? `+${formatINR(v)}` : formatINR(v))

const deltaTone = (v: string, invert = false) => {
  const s = signOf(v)
  if (s === 0) return "text-muted-foreground"
  const good = invert ? s < 0 : s > 0
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
  // Bumped per run so the result block re-mounts and its entrance replays.
  const [runId, setRunId] = useState(0)

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
      setRunId((n) => n + 1)
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

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <Button onClick={run} loading={pending} loadingText="Running the engine…">
            <FlaskConical className="h-4 w-4" aria-hidden />
            Run simulation
          </Button>
          <Button variant="ghost" onClick={resetOverrides} disabled={pending || !hasOverride}>
            <RotateCcw className="h-4 w-4" aria-hidden />
            Reset overrides
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            Nothing is saved. No payslip, payrun or contract is touched.
          </span>
        </div>
      </FormSection>

      {pending && <ResultSkeleton />}

      {!pending && result && (
        <div key={runId} className="stagger space-y-5">
          <NetCompare result={result} />

          {result.matchesStored && !hasOverride && (
            <p className="rounded-xl bg-success-subtle px-4 py-3 text-xs text-success ring-1 ring-inset ring-success/20">
              Baseline verified — with no overrides this reproduces {result.actual?.reference}{" "}
              exactly, to the paisa. Every number below therefore comes from the same engine
              payroll runs.
            </p>
          )}

          {result.changed.length > 0 && (
            <Surface padded>
              <h3 className="mb-3 text-sm font-semibold tracking-tight">What changed</h3>
              <ul className="stagger flex flex-wrap gap-2">
                {result.changed.map((c) => (
                  <li
                    key={c.label}
                    className="inline-flex items-center gap-2 rounded-lg bg-surface-muted py-1.5 pl-3 pr-2.5 text-xs ring-1 ring-inset ring-border/70"
                  >
                    <span className="text-muted-foreground">{c.label}</span>
                    <span className="tabular text-subtle-foreground line-through">{c.from}</span>
                    <ArrowUpRight className="h-3 w-3 rotate-45 text-subtle-foreground" aria-hidden />
                    <span className="tabular font-semibold text-primary">{c.to}</span>
                  </li>
                ))}
              </ul>
            </Surface>
          )}

          <Surface className="overflow-hidden">
            <header className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border/70 px-5 py-4">
              <h3 className="text-sm font-semibold tracking-tight">
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
                  <tr className="border-b border-border/70 bg-surface-muted/60 text-[11px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-5 py-2.5 text-left font-semibold">Rule</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Actual</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Simulated</th>
                    <th className="px-5 py-2.5 text-right font-semibold">Delta</th>
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
          </Surface>

          <Surface as="section" padded>
            <details className="group">
              <summary className="flex cursor-pointer list-none items-center justify-between text-sm font-semibold tracking-tight">
                Facts fed to the engine
                <span className="text-xs font-normal text-muted-foreground transition-transform duration-200 group-open:rotate-180">
                  ▾
                </span>
              </summary>
              <dl className="mt-4 grid grid-cols-2 gap-x-8 gap-y-3 md:grid-cols-4">
                {Object.entries(result.facts).map(([label, value]) => (
                  <div key={label}>
                    <dt className={eyebrow}>{label}</dt>
                    <dd className="mt-1 text-sm font-medium tabular">{value}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </Surface>
        </div>
      )}
    </div>
  )
}

/**
 * Before / after net, side by side. The bars are CSS ratios of the two
 * server figures (see .sim-bar) — the component passes the strings through
 * and draws nothing it computed itself.
 */
function NetCompare({ result }: { result: SimulationResult }) {
  const actual = result.actual
  const simulated = result.simulated.net
  const delta = result.deltas?.net ?? null
  const vars = {
    ["--a" as string]: actual?.net ?? "0",
    ["--b" as string]: simulated,
  }

  return (
    <Surface className="overflow-hidden">
      <div className="grid sm:grid-cols-[1fr_auto_1fr]">
        <div className="p-5">
          <p className={eyebrow}>
            Actual net
            {actual && (
              <span className="ml-1.5 font-mono normal-case tracking-normal text-subtle-foreground">
                {actual.reference}
              </span>
            )}
          </p>
          <p className="mt-2 text-2xl font-semibold tabular text-muted-foreground">
            {actual ? <NumberTicker value={formatINR(actual.net)} /> : "—"}
          </p>
          <div className="sim-bar mt-3" style={vars} aria-hidden>
            <span className="bg-neutral" style={{ ["--v" as string]: actual?.net ?? "0" }} />
          </div>
          {!actual && (
            <p className="mt-2 text-[11.5px] text-muted-foreground">
              No stored payslip for this period to compare against.
            </p>
          )}
        </div>

        <div className="flex items-center justify-center border-y border-border/70 bg-surface-muted/40 px-5 py-3 sm:border-x sm:border-y-0">
          <DeltaChip delta={delta} />
        </div>

        <div className="p-5">
          <p className={eyebrow}>Simulated net</p>
          <p className="mt-2 text-2xl font-semibold tabular text-primary">
            <NumberTicker value={formatINR(simulated)} delayStep={50} />
          </p>
          <div className="sim-bar mt-3" style={vars} aria-hidden>
            <span
              className="bg-primary"
              style={{ ["--v" as string]: simulated, ["--seg-delay" as string]: "140ms" }}
            />
          </div>
        </div>
      </div>
    </Surface>
  )
}

function DeltaChip({ delta }: { delta: string | null }) {
  if (delta === null) {
    return (
      <span className="rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/70">
        no baseline
      </span>
    )
  }
  const s = signOf(delta)
  if (s === 0) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg bg-surface-muted px-2.5 py-1 text-xs font-medium text-muted-foreground ring-1 ring-inset ring-border/70">
        <Minus className="h-3 w-3" aria-hidden />
        no change
      </span>
    )
  }
  const Icon = s > 0 ? ArrowUpRight : ArrowDownRight
  return (
    <span
      className={cn(
        "inline-flex animate-scale-in items-center gap-1 rounded-lg px-2.5 py-1 text-sm font-semibold tabular ring-1 ring-inset",
        s > 0
          ? "bg-success-subtle text-success ring-success/20"
          : "bg-danger-subtle text-danger ring-danger/20",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {signed(delta)}
    </span>
  )
}

function ResultSkeleton() {
  return (
    <div className="space-y-5" aria-busy="true" aria-label="Running the simulation">
      <Surface className="grid gap-5 p-5 sm:grid-cols-[1fr_auto_1fr]">
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-2.5 w-full" />
        </div>
        <div className="flex items-center justify-center">
          <Skeleton className="h-7 w-24" />
        </div>
        <div className="space-y-3">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-7 w-40" />
          <Skeleton className="h-2.5 w-full" />
        </div>
      </Surface>
      <Surface className="space-y-3 p-5">
        <Skeleton className="h-4 w-1/3" />
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </Surface>
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
    <tbody className="stagger-rows">
      <tr className="bg-surface-muted/40">
        <td
          colSpan={4}
          className="px-5 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-subtle-foreground"
        >
          {title}
        </td>
      </tr>
      {lines.map((l) => (
        <tr
          key={l.code}
          className="border-b border-border/60 transition-colors duration-100 hover:bg-surface-hover/60"
        >
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
            {l.delta === null ? "—" : signOf(l.delta) === 0 ? "—" : signed(l.delta)}
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
    <tr className={cn("border-t border-border/70", emphasis && "bg-primary-subtle/50")}>
      <td className={cn("px-5 py-3 font-semibold", emphasis && "text-primary")}>{label}</td>
      <td className="px-5 py-3 text-right tabular text-muted-foreground">
        {actual ? formatINR(actual) : "—"}
      </td>
      <td
        className={cn(
          "px-5 py-3 text-right tabular font-semibold",
          emphasis && "text-base text-primary",
        )}
      >
        {emphasis ? <NumberTicker value={formatINR(simulated)} /> : formatINR(simulated)}
      </td>
      <td
        className={cn(
          "px-5 py-3 text-right tabular font-semibold",
          delta ? deltaTone(delta, invert) : "text-muted-foreground",
        )}
      >
        {delta === null ? "—" : signOf(delta) === 0 ? "no change" : signed(delta)}
      </td>
    </tr>
  )
}
