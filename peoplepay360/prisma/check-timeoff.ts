/**
 * P5 gate check — Demo Scenario B end to end, plus BR-T1/T2/T3/T5.
 * Creates and then removes its own probe records; seeded data is left intact.
 */
import { PrismaClient, RequestStatus } from "@prisma/client"
import {
  approveRequest,
  assertCanRequest,
  balanceOf,
  computeDuration,
  getBalance,
  releaseRequest,
} from "../src/lib/timeoff/balance"

const db = new PrismaClient()

const show = async (employeeId: string, typeId: string, label: string) => {
  const b = await getBalance(employeeId, typeId)
  console.log(
    `    ${label.padEnd(34)} allocated ${String(b.allocated).padStart(5)} · taken ${String(
      b.taken,
    ).padStart(5)} · remaining ${String(b.remaining).padStart(5)}`,
  )
  return b
}

async function main() {
  const aarav = await db.employee.findUniqueOrThrow({
    where: { employeeCode: "EMP/0001" },
    select: { id: true },
  })
  const pto = await db.timeOffType.findFirstOrThrow({
    where: { name: "Paid Time Off" },
    select: { id: true, requiresAllocation: true, unit: true },
  })
  const sick = await db.timeOffType.findFirstOrThrow({
    where: { name: "Sick Leave" },
    select: { id: true, requiresAllocation: true, unit: true },
  })

  console.log("Type policy (BR-T1 / BR-T3)")
  console.log(`  Paid Time Off requiresAllocation: ${pto.requiresAllocation}`)
  console.log(`  Sick Leave    requiresAllocation: ${sick.requiresAllocation}`)

  console.log("\nScenario B — starting balance")
  const start = await show(aarav.id, pto.id, "Aarav / Paid Time Off")

  console.log("\nBR-T4 — duration counts scheduled working days only")
  for (const [label, s, e] of [
    ["Mon 14 → Wed 16 Sep 2026", new Date(Date.UTC(2026, 8, 14)), new Date(Date.UTC(2026, 8, 16))],
    ["Fri 18 → Mon 21 Sep (weekend)", new Date(Date.UTC(2026, 8, 18)), new Date(Date.UTC(2026, 8, 21))],
    ["Sat 19 → Sun 20 Sep (weekend only)", new Date(Date.UTC(2026, 8, 19)), new Date(Date.UTC(2026, 8, 20))],
  ] as const) {
    const d = await computeDuration(aarav.id, s, e, pto.unit)
    console.log(`    ${label.padEnd(34)} -> ${d} days`)
  }

  console.log("\nBR-T1 — over-request is refused with the real number")
  const over = start.remaining + 5
  try {
    await assertCanRequest(aarav.id, pto.id, over)
    console.log(`    requesting ${over} days -> ALLOWED  *** gate failed ***`)
  } catch (e) {
    console.log(`    requesting ${over} days -> BLOCKED: ${(e as Error).message}`)
  }

  console.log("\nBR-T3 — a type needing no allocation is not gated")
  const sickGate = await assertCanRequest(aarav.id, sick.id, 3)
  console.log(`    Sick Leave 3 days -> allowed, allocationId = ${sickGate.allocationId}`)

  console.log("\nBR-T2 — approve consumes, refuse releases")
  const probe = await db.timeOffRequest.create({
    data: {
      employeeId: aarav.id,
      typeId: pto.id,
      startDate: new Date(Date.UTC(2026, 8, 14)),
      endDate: new Date(Date.UTC(2026, 8, 16)),
      duration: 3,
      status: RequestStatus.TO_APPROVE,
      reason: "Gate-check probe",
    },
    select: { id: true },
  })
  console.log("    created a 3-day request (TO_APPROVE)")
  await show(aarav.id, pto.id, "after create (no change yet)")

  await approveRequest(probe.id, null)
  const afterApprove = await show(aarav.id, pto.id, "after approve")

  await releaseRequest(probe.id, "REFUSED", null)
  const afterRefuse = await show(aarav.id, pto.id, "after refuse")

  console.log("\n  Assertions")
  const consumed = afterApprove.taken - start.taken
  const released = afterApprove.taken - afterRefuse.taken
  console.log(`    approve consumed exactly 3 : ${consumed === 3 ? "PASS" : `FAIL (${consumed})`}`)
  console.log(`    refuse released exactly 3  : ${released === 3 ? "PASS" : `FAIL (${released})`}`)
  console.log(
    `    balance returned to start  : ${
      afterRefuse.remaining === start.remaining ? "PASS" : "FAIL"
    }`,
  )

  await db.timeOffRequest.delete({ where: { id: probe.id } })
  console.log("    probe request removed")

  console.log("\nBR-T5 — every allocation's taken matches its approved requests")
  const allocations = await db.timeOffAllocation.findMany({
    select: {
      id: true,
      allocated: true,
      taken: true,
      employee: { select: { firstName: true, lastName: true } },
      type: { select: { name: true } },
      requests: {
        where: { status: RequestStatus.APPROVED },
        select: { duration: true },
      },
    },
  })
  let drift = 0
  let negative = 0
  for (const a of allocations) {
    const expected = a.requests.reduce((sum, r) => sum + Number(r.duration), 0)
    if (Math.abs(expected - Number(a.taken)) > 0.001) {
      drift++
      console.log(
        `    DRIFT ${a.employee.firstName} ${a.employee.lastName} / ${a.type.name}: taken ${a.taken} vs approved ${expected}`,
      )
    }
    if (balanceOf(a).remaining < 0) {
      negative++
      console.log(`    NEGATIVE ${a.employee.firstName} / ${a.type.name}`)
    }
  }
  console.log(`    allocations checked: ${allocations.length}`)
  console.log(`    ledger drift       : ${drift}`)
  console.log(`    negative balances  : ${negative}`)

  const [types, allocCount, reqCount, approved, pending] = await Promise.all([
    db.timeOffType.count(),
    db.timeOffAllocation.count(),
    db.timeOffRequest.count(),
    db.timeOffRequest.count({ where: { status: RequestStatus.APPROVED } }),
    db.timeOffRequest.count({ where: { status: RequestStatus.TO_APPROVE } }),
  ])
  console.log(
    `\nSeeded: ${types} types · ${allocCount} allocations · ${reqCount} requests (${approved} approved, ${pending} pending)`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
