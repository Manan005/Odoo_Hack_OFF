/**
 * P6 gate check — the three rules that decide the score (rules.md §0):
 *   1. Salary rules genuinely drive payslip numbers
 *   2. Payroll uses the period-applicable contract
 *   3. Rules execute in sequence so GROSS/NET build on earlier codes
 * Mutations are reverted before exit.
 */
import { ContractStatus, PrismaClient, RequestStatus, Weekday } from "@prisma/client"
import { buildContext, computePayslip } from "../src/lib/payroll/engine"
import { resolveContract } from "../src/lib/payroll/contract-resolver"

const db = new PrismaClient()

const money = (d: { toString(): string }) =>
  Number(d.toString()).toLocaleString("en-IN", { minimumFractionDigits: 2 })

async function contextFor(employeeId: string, periodStart: Date, periodEnd: Date) {
  const contract = await resolveContract(employeeId, periodStart, periodEnd)
  if (!contract) return null

  const employee = await db.employee.findUniqueOrThrow({
    where: { id: employeeId },
    select: { workingSchedule: { select: { lines: true, hoursPerWeek: true } } },
  })
  const schedule = contract.workingSchedule ?? employee.workingSchedule

  const [attendance, leave] = await Promise.all([
    db.attendance.findMany({
      where: { employeeId, checkIn: { gte: periodStart, lte: periodEnd } },
      select: { checkIn: true, workedHours: true, overtime: true, status: true },
    }),
    db.timeOffRequest.findMany({
      where: {
        employeeId,
        status: RequestStatus.APPROVED,
        startDate: { lte: periodEnd },
        endDate: { gte: periodStart },
      },
      select: {
        startDate: true,
        endDate: true,
        duration: true,
        status: true,
        type: { select: { isPaid: true } },
      },
    }),
  ])

  return {
    contract,
    ctx: buildContext({
      wage: contract.wage,
      periodStart,
      periodEnd,
      scheduleDays: (schedule?.lines ?? []).map((l) => l.day as Weekday),
      hoursPerWeek: Number(schedule?.hoursPerWeek ?? 0),
      attendance,
      leave,
    }),
  }
}

async function main() {
  const aarav = await db.employee.findUniqueOrThrow({
    where: { employeeCode: "EMP/0001" },
    select: { id: true },
  })
  const regular = await db.salaryStructure.findFirstOrThrow({
    where: { name: "Regular Salary" },
    include: { rules: true },
  })

  console.log("Rule 3 — execution order (sequence is the contract)")
  for (const r of [...regular.rules].sort((a, b) => a.sequence - b.sequence)) {
    const how =
      r.computationType === "FIXED"
        ? `fixed ${r.amount}`
        : r.computationType === "PERCENTAGE"
          ? `${r.percentage}% of ${r.percentageBase === "RULE_CODE" ? r.baseRuleCode : r.percentageBase}`
          : r.formula
    console.log(`  ${String(r.sequence).padStart(3)}  ${r.code.padEnd(6)} ${r.category.padEnd(10)} ${how}`)
  }

  console.log("\nRule 2 — the period-applicable contract drives the wage (AC-M2-2)")
  for (const [label, ps, pe] of [
    ["Nov 2025", new Date(Date.UTC(2025, 10, 1)), new Date(Date.UTC(2025, 10, 30))],
    ["Feb 2026", new Date(Date.UTC(2026, 1, 1)), new Date(Date.UTC(2026, 1, 28))],
  ] as const) {
    const built = await contextFor(aarav.id, ps, pe)
    if (!built) {
      console.log(`  ${label}: no applicable contract`)
      continue
    }
    const result = computePayslip(regular.rules, built.ctx)
    const basic = result.lines.find((l) => l.code === "BASIC")!
    console.log(
      `  ${label}  contract ${built.contract!.reference}  wage ${money(built.ctx.wage)}  ->  BASIC ${money(basic.amount)}  NET ${money(result.net)}`,
    )
  }

  console.log("\nFull payslip — Aarav, Sep 2026")
  const sep = await contextFor(
    aarav.id,
    new Date(Date.UTC(2026, 8, 1)),
    new Date(Date.UTC(2026, 8, 30)),
  )
  if (!sep) throw new Error("expected a contract for Sep 2026")

  console.log("  facts:")
  console.log(`    scheduledDays ${sep.ctx.scheduledDays}  workedDays ${sep.ctx.workedDays}  absentDays ${sep.ctx.absentDays}`)
  console.log(`    overtimeHours ${sep.ctx.overtimeHours}  unpaidLeaveDays ${sep.ctx.unpaidLeaveDays}`)
  console.log(`    hourlyRate ${sep.ctx.hourlyRate}  perDayRate ${sep.ctx.perDayRate}`)

  const slip = computePayslip(regular.rules, sep.ctx)
  console.log("\n  seq  rule                      category    rate                          amount")
  for (const l of slip.lines) {
    console.log(
      `  ${String(l.sequence).padStart(3)}  ${l.name.padEnd(25)} ${l.category.padEnd(11)} ${l.rate.padEnd(29)} ${money(l.amount).padStart(12)}`,
    )
  }
  console.log(
    `\n  basic ${money(slip.basic)} · allowances ${money(slip.allowances)} · gross ${money(slip.gross)} · deductions ${money(slip.deductions)} · NET ${money(slip.net)}`,
  )

  console.log("\n  Cross-checks")
  const line = (code: string) => slip.lines.find((l) => l.code === code)!
  const sumAllow = ["HRA", "STD", "MEAL", "BONUS", "OT"].reduce(
    (s, c) => s + Number(line(c).amount),
    0,
  )
  const grossOk = Math.abs(Number(slip.gross) - (Number(line("BASIC").amount) + sumAllow)) < 0.01
  const dedTotal = ["PF", "PT", "LWP", "TDS"].reduce((s, c) => s + Number(line(c).amount), 0)
  const netOk = Math.abs(Number(slip.net) - (Number(slip.gross) - dedTotal)) < 0.01
  const basicOk = Math.abs(Number(line("BASIC").amount) - Number(sep.ctx.wage) * 0.5) < 0.01
  const hraOk = Math.abs(Number(line("HRA").amount) - Number(line("BASIC").amount) * 0.2) < 0.01
  console.log(`    BASIC is 50% of wage        : ${basicOk ? "PASS" : "FAIL"}`)
  console.log(`    HRA is 20% of BASIC         : ${hraOk ? "PASS" : "FAIL"}`)
  console.log(`    GROSS = basic + allowances  : ${grossOk ? "PASS" : "FAIL"}`)
  console.log(`    NET = gross - deductions    : ${netOk ? "PASS" : "FAIL"}`)

  console.log("\nRule 1 — changing a rule changes the payslip (AC-M7-1)")
  const hraRule = regular.rules.find((r) => r.code === "HRA")!
  const beforeHra = Number(line("HRA").amount)
  const beforeNet = Number(slip.net)

  await db.salaryRule.update({ where: { id: hraRule.id }, data: { percentage: "25" } })
  const bumped = await db.salaryStructure.findFirstOrThrow({
    where: { id: regular.id },
    include: { rules: true },
  })
  const after = computePayslip(bumped.rules, sep.ctx)
  const afterHra = Number(after.lines.find((l) => l.code === "HRA")!.amount)
  console.log(`    HRA 20% -> 25% : ${money(beforeHra)} -> ${money(afterHra)}`)
  console.log(`    NET            : ${money(beforeNet)} -> ${money(after.net)}`)
  console.log(
    `    payslip responded to config, no code change : ${afterHra > beforeHra && Number(after.net) !== beforeNet ? "PASS" : "FAIL"}`,
  )

  await db.salaryRule.update({ where: { id: hraRule.id }, data: { percentage: "20" } })
  console.log("    reverted HRA to 20%")

  console.log("\nA broken rule fails loudly rather than silently zeroing (AC-M7-2)")
  const broken = bumped.rules.map((r) =>
    r.code === "GROSS" ? { ...r, formula: "BASIC + NOT_A_RULE" } : r,
  )
  try {
    computePayslip(broken, sep.ctx)
    console.log("    FAIL — computed without complaint")
  } catch (e) {
    console.log(`    PASS — ${(e as Error).message.slice(0, 120)}…`)
  }

  console.log("\nEvery structure computes for a representative wage")
  const structures = await db.salaryStructure.findMany({ include: { rules: true } })
  for (const s of structures) {
    const r = computePayslip(s.rules, sep.ctx)
    console.log(
      `  ${s.name.padEnd(16)} ${String(s.rules.length).padStart(2)} rules -> gross ${money(r.gross).padStart(12)}  net ${money(r.net).padStart(12)}`,
    )
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
