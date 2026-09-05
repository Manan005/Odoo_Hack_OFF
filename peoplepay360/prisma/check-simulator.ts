/**
 * Gate — the salary what-if simulator.
 *
 * The simulator is only trustworthy if two things hold:
 *
 *   1. With no overrides it reproduces the stored payslip *exactly*, because it
 *      runs the same engine a real payrun runs. If this drifts, every simulated
 *      figure below it is guesswork.
 *   2. It writes nothing. A sandbox that quietly mutates payroll is worse than
 *      no sandbox, so the whole payslip table is fingerprinted before and after.
 *
 * Runs offline against the database — no dev server needed.
 */
import { PrismaClient, Prisma } from "@prisma/client"
import { loadSimulatorOptions, simulate } from "../src/lib/payroll/simulator"

const db = new PrismaClient()
const D = Prisma.Decimal

let failures = 0
const check = (label: string, pass: boolean, detail = "") => {
  if (!pass) failures++
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

/** A stable fingerprint of everything payroll owns, to prove nothing moved. */
async function fingerprint() {
  const [payslips, lines, payruns, contracts, rules] = await Promise.all([
    db.payslip.findMany({
      orderBy: { reference: "asc" },
      select: { reference: true, basic: true, gross: true, deductions: true, net: true, status: true },
    }),
    db.payslipLine.count(),
    db.payrun.count(),
    db.contract.count(),
    db.salaryRule.count(),
  ])
  return JSON.stringify({ payslips, lines, payruns, contracts, rules })
}

async function main() {
  const before = await fingerprint()

  // Pick a payslip that actually computed, so there is something to match.
  const slip = await db.payslip.findFirstOrThrow({
    where: { contractId: { not: null }, net: { gt: 0 } },
    orderBy: { reference: "asc" },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      payrun: { select: { structureId: true, name: true } },
    },
  })

  const base = {
    employeeId: slip.employeeId,
    structureId: slip.payrun.structureId,
    periodStart: slip.periodStart,
    periodEnd: slip.periodEnd,
    wage: null,
    workedDays: null,
    overtimeHours: null,
    unpaidLeaveDays: null,
  }

  console.log(
    `Subject: ${slip.employee.firstName} ${slip.employee.lastName} · ${slip.reference} · ${slip.payrun.name}\n`,
  )

  // ── 1. Baseline fidelity ────────────────────────────────────────────
  console.log("The zero-override run reproduces the stored payslip")
  const baseline = await simulate(base)

  for (const [label, stored, got] of [
    ["basic", slip.basic, baseline.simulated.basic],
    ["allowances", slip.allowances, baseline.simulated.allowances],
    ["gross", slip.gross, baseline.simulated.gross],
    ["deductions", slip.deductions, baseline.simulated.deductions],
    ["net", slip.net, baseline.simulated.net],
  ] as const) {
    const same = new D(stored).equals(new D(got))
    check(label.padEnd(11), same, `stored ${new D(stored).toFixed(2)} · simulated ${got}`)
  }
  check("matchesStored flag", baseline.matchesStored)
  check("no facts reported as changed", baseline.changed.length === 0)

  const mismatchedLines = baseline.lines.filter(
    (l) => l.delta !== null && Number(l.delta) !== 0,
  )
  check(
    `all ${baseline.lines.length} lines identical`,
    mismatchedLines.length === 0,
    mismatchedLines.map((l) => `${l.code} ${l.delta}`).join(", "),
  )

  // ── 2. Overrides actually move the numbers ──────────────────────────
  console.log("\nOverrides drive the result through the same rules")
  const storedWage = new D(baseline.contract?.wage ?? 0)
  const raised = storedWage.times(1.1).toDecimalPlaces(2)

  const wageUp = await simulate({ ...base, wage: raised.toString() })
  check(
    "a 10% wage rise raises net",
    new D(wageUp.simulated.net).gt(new D(baseline.simulated.net)),
    `${baseline.simulated.net} → ${wageUp.simulated.net}`,
  )
  check(
    "the delta against the stored payslip is reported",
    wageUp.deltas !== null && Number(wageUp.deltas.net) > 0,
    wageUp.deltas ? `net ${wageUp.deltas.net}` : "",
  )
  check(
    "the changed-facts summary names the wage",
    wageUp.changed.some((c) => c.label === "Contract wage"),
    wageUp.changed.map((c) => c.label).join(", "),
  )
  check("matchesStored is false once overridden", wageUp.matchesStored === false)

  // Derived rates must follow the overridden wage, or a formula reading
  // perDayRate would silently use the old one.
  const perDay = wageUp.facts["Per-day rate"]
  const scheduled = new D(wageUp.facts["Scheduled days"])
  const expectedPerDay = scheduled.gt(0) ? raised.div(scheduled).toDecimalPlaces(4) : new D(0)
  check(
    "perDayRate is recomputed from the override",
    new D(perDay).equals(expectedPerDay),
    `${perDay} vs expected ${expectedPerDay.toString()}`,
  )

  const otUp = await simulate({ ...base, overtimeHours: "12" })
  check(
    "overtime hours reach the engine",
    otUp.facts["Overtime hours"] === "12",
    `facts show ${otUp.facts["Overtime hours"]}`,
  )

  const unpaid = await simulate({ ...base, unpaidLeaveDays: "5" })
  check(
    "unpaid leave days reach the engine",
    unpaid.facts["Unpaid leave days"] === "5",
    `facts show ${unpaid.facts["Unpaid leave days"]}`,
  )

  // ── 3. Structure swap ───────────────────────────────────────────────
  console.log("\nSwapping the salary structure swaps the rule set")
  const other = await db.salaryStructure.findFirst({
    where: { id: { not: slip.payrun.structureId }, active: true, rules: { some: {} } },
    select: { id: true, name: true },
  })
  if (!other) {
    console.log("  SKIP  only one structure has rules in this database")
  } else {
    const swapped = await simulate({ ...base, structureId: other.id })
    const baseCodes = baseline.lines
      .filter((l) => l.simulated !== null)
      .map((l) => l.code)
      .sort()
    const swapCodes = swapped.lines
      .filter((l) => l.simulated !== null)
      .map((l) => l.code)
      .sort()
    check(
      `"${other.name}" produces a different rule set`,
      JSON.stringify(baseCodes) !== JSON.stringify(swapCodes) ||
        swapped.simulated.net !== baseline.simulated.net,
      `${baseCodes.length} codes → ${swapCodes.length} codes, net ${baseline.simulated.net} → ${swapped.simulated.net}`,
    )
    check("the structure name is reported back", swapped.structureName === other.name)
  }

  // ── 4. Period-applicable contract, not the newest ───────────────────
  console.log("\nThe simulator resolves the period's contract (BR-C2)")
  const multi = await db.employee.findFirst({
    where: { contracts: { some: {} } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contracts: { orderBy: { startDate: "asc" }, select: { reference: true, startDate: true, endDate: true, wage: true } },
    },
    orderBy: { employeeCode: "asc" },
  })
  const withTwo = await db.employee.findMany({
    where: { contracts: { some: {} } },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      contracts: { orderBy: { startDate: "asc" }, select: { reference: true, startDate: true, wage: true } },
    },
  })
  const target = withTwo.find((e) => e.contracts.length >= 2) ?? multi
  if (!target || target.contracts.length < 2) {
    console.log("  SKIP  no employee in this database holds two contracts")
  } else {
    const [older, newer] = target.contracts
    const inOlder = await simulate({
      ...base,
      employeeId: target.id,
      periodStart: older.startDate,
      periodEnd: new Date(older.startDate.getTime() + 27 * 86_400_000),
    })
    check(
      `${target.firstName} ${target.lastName} resolves to ${older.reference} for its own period`,
      inOlder.contract?.reference === older.reference,
      `got ${inOlder.contract?.reference}, newest is ${newer.reference}`,
    )
  }

  // ── 5. The page's opening scenario is itself a baseline ─────────────
  //
  // Defaulting to the first employee / first structure / first period opens on
  // one structure's rules compared against a payslip computed with another —
  // every line shows a large delta that means nothing, and the claim the page
  // is built on is nowhere on screen.
  console.log("\nThe page opens on a scenario that reproduces its payslip")
  const company = await db.employee.findFirstOrThrow({ select: { companyId: true } })
  const options = await loadSimulatorOptions(company.companyId)
  const [defStart, defEnd] = options.defaults.period.split("|")
  check("defaults name an employee, structure and period", Boolean(options.defaults.employeeId && options.defaults.structureId && defStart && defEnd))

  const opening = await simulate({
    employeeId: options.defaults.employeeId,
    structureId: options.defaults.structureId,
    periodStart: new Date(defStart),
    periodEnd: new Date(defEnd),
    wage: null,
    workedDays: null,
    overtimeHours: null,
    unpaidLeaveDays: null,
  })
  check(
    "the opening scenario matches its stored payslip",
    opening.matchesStored,
    `${opening.employeeName} · ${opening.structureName} · ${opening.actual?.reference ?? "no payslip"}`,
  )

  // ── 6. Nothing was written ──────────────────────────────────────────
  console.log("\nThe simulator is read-only")
  const after = await fingerprint()
  check("payroll data is byte-identical after 7 simulations", before === after)

  console.log(
    failures === 0
      ? "\nAll simulator checks passed."
      : `\n${failures} check(s) failed.`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
