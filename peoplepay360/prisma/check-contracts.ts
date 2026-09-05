/**
 * P3 gate check — BR-C1 overlap detection and BR-C2 period resolution.
 * Read-only apart from the rollback-style cleanup at the end.
 */
import { ContractStatus, PrismaClient } from "@prisma/client"
import {
  findOverlappingRunningContract,
  resolveContract,
} from "../src/lib/payroll/contract-resolver"

const db = new PrismaClient()

async function main() {
  const aarav = await db.employee.findUniqueOrThrow({
    where: { employeeCode: "EMP/0001" },
    select: { id: true, firstName: true },
  })

  console.log("Aarav's contracts:")
  const contracts = await db.contract.findMany({
    where: { employeeId: aarav.id },
    orderBy: { startDate: "asc" },
    select: { reference: true, startDate: true, endDate: true, wage: true, status: true },
  })
  for (const c of contracts) {
    const end = c.endDate ? c.endDate.toISOString().slice(0, 10) : "open-ended"
    console.log(
      `  ${c.reference}  ${c.startDate.toISOString().slice(0, 10)} → ${end}  ₹${c.wage}  ${c.status}`,
    )
  }

  console.log("\nAC-M2-2 — period-applicable contract resolution (BR-C2)")
  const periods: Array<[string, Date, Date]> = [
    ["Nov 2025", new Date(2025, 10, 1), new Date(2025, 10, 30)],
    ["Sep 2025", new Date(2025, 8, 1), new Date(2025, 8, 30)],
    ["Feb 2026", new Date(2026, 1, 1), new Date(2026, 1, 28)],
    ["Sep 2026", new Date(2026, 8, 1), new Date(2026, 8, 30)],
    ["Mar 2025", new Date(2025, 2, 1), new Date(2025, 2, 31)],
  ]
  for (const [label, start, end] of periods) {
    const c = await resolveContract(aarav.id, start, end)
    console.log(
      `  ${label.padEnd(9)} -> ${c ? `${c.reference}  wage ₹${c.wage}` : "no applicable contract"}`,
    )
  }

  console.log("\nAC-M2-1 — overlap detection (BR-C1)")
  const cases: Array<[string, Date, Date | null]> = [
    ["Jan 2026 – open-ended (dup of running)", new Date(2026, 0, 1), null],
    ["Jun 2026 – open-ended (starts mid-run)", new Date(2026, 5, 1), null],
    ["Aug–Oct 2025 (overlaps prior)", new Date(2025, 7, 1), new Date(2025, 9, 31)],
    ["Jan–Mar 2025 (before everything)", new Date(2025, 0, 1), new Date(2025, 2, 31)],
    ["Apr–Jun 2025 (gap before prior)", new Date(2025, 3, 1), new Date(2025, 5, 30)],
  ]
  for (const [label, start, end] of cases) {
    const clash = await findOverlappingRunningContract(aarav.id, start, end)
    console.log(`  ${label.padEnd(40)} -> ${clash ? `BLOCKED by ${clash.reference}` : "allowed"}`)
  }

  console.log("\nSanity — no employee holds overlapping RUNNING contracts")
  const running = await db.contract.findMany({
    where: { status: ContractStatus.RUNNING },
    select: { employeeId: true, reference: true, startDate: true, endDate: true },
  })
  const byEmployee = new Map<string, typeof running>()
  for (const c of running) {
    byEmployee.set(c.employeeId, [...(byEmployee.get(c.employeeId) ?? []), c])
  }
  let conflicts = 0
  for (const [, list] of byEmployee) {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i]
        const b = list[j]
        const aEndsFirst = a.endDate !== null && a.endDate < b.startDate
        const bEndsFirst = b.endDate !== null && b.endDate < a.startDate
        if (!aEndsFirst && !bEndsFirst) {
          console.log(`  CONFLICT: ${a.reference} vs ${b.reference}`)
          conflicts++
        }
      }
    }
  }
  console.log(`  conflicts found: ${conflicts}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
