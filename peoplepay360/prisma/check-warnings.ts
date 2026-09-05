/**
 * P7 gate — warning detection and the blocking gate on VALIDATE.
 *
 * PDF rendering and email are verified over HTTP instead (see
 * check-payslip-delivery.ts): @react-pdf/hyphenate declares only an `import`
 * condition in its exports map, so tsx's CJS resolution cannot load it. Next's
 * bundler resolves it fine, which is why the route works in the app.
 *
 * Probe records are removed and edited data restored.
 */
import { PrismaClient } from "@prisma/client"
import {
  computePayrunSlips,
  createPayrunWithPayslips,
  findEligibleEmployees,
  validatePayrunRecord,
} from "../src/lib/payroll/payrun-service"
import { regenerateWarnings } from "../src/lib/payroll/warnings"

const db = new PrismaClient()

const attempt = async (fn: () => Promise<unknown>) => {
  try {
    await fn()
    return { ok: true as const, message: "" }
  } catch (e) {
    return { ok: false as const, message: (e as Error).message }
  }
}

async function main() {
  const company = await db.company.findFirstOrThrow({ select: { id: true } })
  const structure = await db.salaryStructure.findFirstOrThrow({
    where: { name: "Regular Salary" },
    select: { id: true },
  })

  const scope = {
    name: "Gate Check — warnings",
    structureId: structure.id,
    periodStart: new Date(Date.UTC(2026, 1, 1)),
    periodEnd: new Date(Date.UTC(2026, 1, 28)),
    employeeTypes: [],
    departmentId: null,
  }

  // Two seeded employees ship without bank details — include them deliberately.
  const noBank = await db.employee.findMany({
    where: { bankAccountNumber: null },
    select: { id: true, firstName: true, lastName: true },
  })
  console.log(`Seeded employees without bank details: ${noBank.length}`)
  for (const e of noBank) console.log(`  ${e.firstName} ${e.lastName}`)

  const eligible = await findEligibleEmployees(company.id, scope)
  const picked = [
    ...noBank.map((e) => e.id),
    ...eligible
      .filter((e) => !noBank.some((n) => n.id === e.id))
      .slice(0, 2)
      .map((e) => e.id),
  ]

  const payrun = await createPayrunWithPayslips(company.id, { ...scope, employeeIds: picked })
  console.log(`\nProbe payrun with ${picked.length} employees`)

  const computed = await computePayrunSlips(payrun.id)
  console.log(
    `  computed ${computed.computed}, skipped ${computed.skipped}, warnings ${computed.warnings} (${computed.blocking} blocking)`,
  )

  const warnings = await db.payrollWarning.findMany({
    where: { payrunId: payrun.id },
    orderBy: [{ severity: "asc" }, { code: "asc" }],
  })
  console.log("\nWarnings raised")
  for (const w of warnings) {
    console.log(`  [${w.severity.padEnd(8)}] ${w.code.padEnd(21)} ${w.message}`)
  }

  console.log("\nNon-blocking warnings must not stop validation")
  const validated = await attempt(() => validatePayrunRecord(payrun.id))
  console.log(
    `  ${validated.ok ? "PASS — validated despite non-blocking warnings" : `refused — ${validated.message}`}`,
  )

  console.log("\nAC-M8-4 — a blocking warning stops VALIDATE")
  const victim = await db.payslip.findFirstOrThrow({
    where: { payrunId: payrun.id },
    select: { id: true, contractId: true },
  })
  // Simulate the "no applicable contract" case.
  await db.payslip.update({ where: { id: victim.id }, data: { contractId: null } })
  await db.payrun.update({ where: { id: payrun.id }, data: { status: "COMPUTED" } })
  const regen = await regenerateWarnings(payrun.id)
  console.log(`  regenerated: ${regen.total} warnings, ${regen.blocking} blocking`)

  const blocked = await attempt(() => validatePayrunRecord(payrun.id))
  console.log(`  ${blocked.ok ? "FAIL — validation was allowed" : `PASS — ${blocked.message}`}`)

  console.log("\nResolved warnings must clear, not linger")
  await db.payslip.update({ where: { id: victim.id }, data: { contractId: victim.contractId } })
  const afterFix = await regenerateWarnings(payrun.id)
  console.log(
    `  blocking after restoring the contract: ${afterFix.blocking} ${afterFix.blocking === 0 ? "PASS" : "FAIL"}`,
  )
  const nowValid = await attempt(() => validatePayrunRecord(payrun.id))
  console.log(`  validate now: ${nowValid.ok ? "PASS" : `FAIL — ${nowValid.message}`}`)

  console.log("\nEvery warning code is reachable")
  const seen = new Set(
    (await db.payrollWarning.findMany({ select: { code: true } })).map((w) => w.code),
  )
  for (const code of [
    "NO_CONTRACT",
    "DUPLICATE_PAYSLIP",
    "MISSING_BANK_DETAILS",
    "MISSING_EMAIL",
    "NO_STRUCTURE",
    "CONTRACT_EXPIRING",
    "ZERO_NET",
  ]) {
    console.log(`  ${code.padEnd(22)} ${seen.has(code) ? "seen in this run" : "not triggered here"}`)
  }

  await db.payrun.delete({ where: { id: payrun.id } })
  console.log("\nProbe payrun removed.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
