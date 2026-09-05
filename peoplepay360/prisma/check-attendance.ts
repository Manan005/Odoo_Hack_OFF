/**
 * P4 gate check — BR-A1 worked hours, BR-A2 overtime, BR-A3 classification,
 * plus the seeded exception mix the P8 dashboard reports on. Read-only.
 */
import { AttendanceStatus, PrismaClient, Weekday } from "@prisma/client"
import {
  computeOvertime,
  computeStatus,
  computeWorkedHours,
  deriveAttendance,
} from "../src/lib/attendance/compute"

const db = new PrismaClient()

const line = {
  day: Weekday.MONDAY,
  startTime: "09:00",
  endTime: "18:00",
  breakHours: 1,
  hours: 8,
}

const at = (h: number, m = 0) => new Date(2026, 8, 7, h, m) // a Monday

async function main() {
  console.log("BR-A1 — worked hours from the clock span")
  console.log("  09:05 → 18:10          ->", computeWorkedHours(at(9, 5), at(18, 10)), "h")
  console.log("  09:00 → 17:30          ->", computeWorkedHours(at(9), at(17, 30)), "h")
  console.log("  missing check-out      ->", computeWorkedHours(at(9), null), "h")
  console.log("  check-out before in    ->", computeWorkedHours(at(18), at(9)), "h")

  console.log("\nBR-A2 — overtime beyond the scheduled hours (expected 8h)")
  console.log("  worked 9.08            ->", computeOvertime(9.08, line))
  console.log("  worked 8.00            ->", computeOvertime(8, line))
  console.log("  worked 6.50            ->", computeOvertime(6.5, line))
  console.log("  unscheduled day (null) ->", computeOvertime(4, null), "(all hours are overtime)")

  console.log("\nBR-A3 — classification, 15 min grace on a 09:00 start")
  console.log("  in 09:05 worked 8h     ->", computeStatus(at(9, 5), 8, line))
  console.log("  in 09:16 worked 8h     ->", computeStatus(at(9, 16), 8, line))
  console.log("  in 09:32 worked 8.43h  ->", computeStatus(at(9, 32), 8.43, line))
  console.log("  in 09:00 worked 3h     ->", computeStatus(at(9), 3, line))

  console.log("\nderiveAttendance — the single entry point")
  console.log("  present  ->", JSON.stringify(deriveAttendance(at(9, 5), at(18, 10), [line])))
  console.log("  late     ->", JSON.stringify(deriveAttendance(at(9, 40), at(18, 10), [line])))
  console.log(
    "  absent   ->",
    JSON.stringify(deriveAttendance(at(9), at(18), [line], AttendanceStatus.ABSENT)),
    "(clock values forced to zero)",
  )
  console.log("  no sched ->", JSON.stringify(deriveAttendance(at(9), at(13), [])))

  console.log("\nSeeded data — the exception mix the dashboard reports")
  const [total, byStatus, missing, edited, overtimeRows, agg] = await Promise.all([
    db.attendance.count(),
    db.attendance.groupBy({ by: ["status"], _count: true }),
    db.attendance.count({ where: { checkOut: null, status: { not: AttendanceStatus.ABSENT } } }),
    db.attendance.count({ where: { manuallyEdited: true } }),
    db.attendance.count({ where: { overtime: { gt: 0 } } }),
    db.attendance.aggregate({ _sum: { workedHours: true, overtime: true } }),
  ])
  console.log(`  total rows          : ${total}`)
  for (const s of byStatus.sort((a, b) => b._count - a._count)) {
    console.log(`    ${String(s.status).padEnd(9)}: ${s._count}`)
  }
  console.log(`  missing check-outs  : ${missing}`)
  console.log(`  manual edits        : ${edited}`)
  console.log(`  rows with overtime  : ${overtimeRows}`)
  console.log(`  total worked hours  : ${agg._sum.workedHours}`)
  console.log(`  total overtime hours: ${agg._sum.overtime}`)

  const coverage = total > 0 ? ((total - missing) / total) * 100 : 0
  console.log(`  attendance coverage : ${coverage.toFixed(1)}%`)

  console.log("\nStored values match a fresh derivation (spot-check 200 rows)")
  const sample = await db.attendance.findMany({
    take: 200,
    where: { status: { not: AttendanceStatus.ABSENT }, checkOut: { not: null } },
    include: { employee: { select: { workingSchedule: { select: { lines: true } } } } },
  })
  let mismatches = 0
  for (const row of sample) {
    const lines = row.employee.workingSchedule?.lines ?? []
    const d = deriveAttendance(row.checkIn, row.checkOut, lines, row.status)
    if (Math.abs(d.workedHours - Number(row.workedHours)) > 0.01) mismatches++
    else if (Math.abs(d.overtime - Number(row.overtime)) > 0.01) mismatches++
  }
  console.log(`  mismatches: ${mismatches} / ${sample.length}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
