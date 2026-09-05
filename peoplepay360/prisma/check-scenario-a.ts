/**
 * P6 gate — Demo Scenario A driven through the payrun service, which is what
 * the Server Actions delegate to. Creates probe payruns and deletes them.
 */
import { PrismaClient } from "@prisma/client"
import {
  computePayrunSlips,
  createPayrunWithPayslips,
  findEligibleEmployees,
  markPayrunPaidRecord,
  validatePayrunRecord,
} from "../src/lib/payroll/payrun-service"

const db = new PrismaClient()

/** The actions add auth + revalidation on top; the logic under test is here. */
const attempt = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return { ok: true as const, message: "" }
  } catch (e) {
    return { ok: false as const, message: (e as Error).message }
  }
}

const money = (v: unknown) =>
  Number(String(v)).toLocaleString("en-IN", { minimumFractionDigits: 2 })

async function main() {
  const company = await db.company.findFirstOrThrow({ select: { id: true } })
  const structure = await db.salaryStructure.findFirstOrThrow({
    where: { name: "Regular Salary" },
    select: { id: true },
  })

  const scope = {
    name: "Gate Check — Feb 2026",
    structureId: structure.id,
    periodStart: new Date(Date.UTC(2026, 1, 1)),
    periodEnd: new Date(Date.UTC(2026, 1, 28)),
    employeeTypes: [],
    departmentId: null,
  }

  const payrunsBefore = await db.payrun.count()
  console.log(`Payruns before anything: ${payrunsBefore}`)

  console.log("\nAC-M8-1 — listing eligible employees must not create a payrun")
  const eligible = await findEligibleEmployees(company.id, scope)
  console.log(`  eligible employees: ${eligible.length}`)
  const afterList = await db.payrun.count()
  console.log(
    `  payruns after listing: ${afterList} -> ${afterList === payrunsBefore ? "PASS (nothing written)" : "FAIL"}`,
  )

  console.log("\n  Wizard step 2 grid (sample)")
  for (const e of eligible.slice(0, 4)) {
    console.log(
      `    ${e.name.padEnd(22)} ${String(e.hoursPerWeek).padStart(5)} h/wk  from ${e.contractStart}  ${money(e.wage).padStart(12)}`,
    )
  }

  console.log("\nAC-M8-2 — only the selected employees get payslips")
  const chosen = eligible.slice(0, 3)
  const payrun = await createPayrunWithPayslips(company.id, {
    ...scope,
    employeeIds: chosen.map((e) => e.id),
  })
  const slipCount = await db.payslip.count({ where: { payrunId: payrun.id } })
  console.log(
    `  selected ${chosen.length} of ${eligible.length} -> ${slipCount} payslips ${slipCount === chosen.length ? "PASS" : "FAIL"}`,
  )

  console.log("\nCOMPUTE")
  const computed = await computePayrunSlips(payrun.id)
  console.log(`  computed ${computed.computed}, skipped ${computed.skipped}`)

  const slips = await db.payslip.findMany({
    where: { payrunId: payrun.id },
    include: {
      employee: { select: { firstName: true, lastName: true } },
      contract: { select: { reference: true, wage: true } },
      lines: { orderBy: { sequence: "asc" } },
    },
    orderBy: { employee: { firstName: "asc" } },
  })
  for (const s of slips) {
    console.log(
      `    ${`${s.employee.firstName} ${s.employee.lastName}`.padEnd(20)} ${(s.contract?.reference ?? "none").padEnd(14)} wage ${money(s.contract?.wage ?? 0).padStart(11)}  net ${money(s.net).padStart(11)}  (${s.lines.length} lines)`,
    )
  }

  console.log("\nAC-M8-3 — recompute is idempotent")
  const linesFirst = slips.reduce((n, s) => n + s.lines.length, 0)
  const netsFirst = slips.map((s) => String(s.net))
  await computePayrunSlips(payrun.id)
  const slipsAfter = await db.payslip.count({ where: { payrunId: payrun.id } })
  const linesAfter = await db.payslipLine.count({ where: { payslip: { payrunId: payrun.id } } })
  const netsAfter = await db.payslip
    .findMany({
      where: { payrunId: payrun.id },
      select: { net: true },
      orderBy: { employee: { firstName: "asc" } },
    })
    .then((rows) => rows.map((r) => String(r.net)))
  console.log(`  payslips ${slipCount} -> ${slipsAfter} ${slipsAfter === slipCount ? "PASS" : "FAIL"}`)
  console.log(`  lines    ${linesFirst} -> ${linesAfter} ${linesAfter === linesFirst ? "PASS" : "FAIL"}`)
  console.log(
    `  nets identical: ${netsFirst.every((n, i) => n === netsAfter[i]) ? "PASS" : "FAIL"}`,
  )

  console.log("\nLifecycle — Draft → Computed → Validated → Paid")
  const statusNow = async () =>
    (await db.payrun.findUniqueOrThrow({ where: { id: payrun.id }, select: { status: true } }))
      .status
  console.log(`  after compute : ${await statusNow()}`)
  await validatePayrunRecord(payrun.id)
  console.log(`  after validate: ${await statusNow()}`)
  await markPayrunPaidRecord(payrun.id)
  console.log(`  after paid    : ${await statusNow()}`)

  const paidSlips = await db.payslip.count({ where: { payrunId: payrun.id, status: "PAID" } })
  console.log(`  payslips PAID : ${paidSlips}/${slipCount} ${paidSlips === slipCount ? "PASS" : "FAIL"}`)

  console.log("\nAC-M8-5 — a paid payrun cannot be recomputed")
  const blocked = await attempt(() => computePayrunSlips(payrun.id))
  console.log(`  ${blocked.ok ? "FAIL (allowed)" : `PASS — ${blocked.message}`}`)

  console.log("\nOut-of-order transitions are refused")
  const fresh = await createPayrunWithPayslips(company.id, {
    ...scope,
    name: "Gate Check — order",
    employeeIds: [chosen[0].id],
  })
  const earlyValidate = await attempt(() => validatePayrunRecord(fresh.id))
  console.log(
    `  validate before compute  : ${earlyValidate.ok ? "FAIL (allowed)" : `PASS — ${earlyValidate.message}`}`,
  )
  await computePayrunSlips(fresh.id)
  const earlyPaid = await attempt(() => markPayrunPaidRecord(fresh.id))
  console.log(
    `  mark paid before validate: ${earlyPaid.ok ? "FAIL (allowed)" : `PASS — ${earlyPaid.message}`}`,
  )

  await db.payrun.deleteMany({ where: { id: { in: [payrun.id, fresh.id] } } })
  console.log(`\nProbe payruns removed. Payruns now: ${await db.payrun.count()} (started at ${payrunsBefore})`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
