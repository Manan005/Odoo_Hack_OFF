/**
 * P8 gate — scoring rule 3: the dashboard reads live data.
 * Proves the aggregates match hand-computed totals, respond to every filter,
 * and move when underlying records change. Mutations are reverted.
 */
import { EmployeeType, PrismaClient, RequestStatus } from "@prisma/client"
import {
  getAttendanceOverview,
  getDepartmentOverview,
  getKpis,
  getMonthlyTrend,
  getPayslipStatusSplit,
  getSalaryByDepartment,
  getTimeOffOverview,
  type DashboardFilters,
} from "../src/lib/dashboard/aggregate"

const db = new PrismaClient()

const inr = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 0 })

async function main() {
  const company = await db.company.findFirstOrThrow({ select: { id: true, name: true } })

  // August 2026 is the newest fully seeded, paid period.
  const base: DashboardFilters = {
    companyId: company.id,
    periodStart: new Date(Date.UTC(2026, 7, 1)),
    periodEnd: new Date(Date.UTC(2026, 7, 31, 23, 59, 59)),
  }

  console.log("Period: August 2026, all departments, all employee types\n")

  const kpis = await getKpis(base)
  console.log("KPI cards")
  console.log(`  Total Net Salary Paid : ₹${inr(kpis.totalNet)}`)
  console.log(
    `  vs previous period    : ${kpis.netDeltaPct === null ? "n/a" : `${kpis.netDeltaPct.toFixed(1)}%`}`,
  )
  console.log(
    `  Payslips Generated    : ${kpis.payslipsGenerated} (${kpis.payslipsPaid} paid, ${kpis.payslipsPending} pending)`,
  )
  console.log(`  Avg Salary / Employee : ₹${inr(kpis.avgSalary)}`)
  console.log(`  Approved Time Off     : ${kpis.approvedTimeOffDays} days`)
  console.log(
    `  Attendance Health     : ${kpis.attendanceHealthPct.toFixed(1)}% (${kpis.presentish}/${kpis.expectedRecords})`,
  )

  console.log("\nCross-check against the raw tables")
  const rawNet = await db.payslip.aggregate({
    where: {
      periodStart: { gte: base.periodStart },
      periodEnd: { lte: base.periodEnd },
    },
    _sum: { net: true },
    _count: true,
  })
  const netOk = Math.abs(Number(rawNet._sum.net) - kpis.totalNet) < 0.01
  const countOk = rawNet._count === kpis.payslipsGenerated
  console.log(`  raw payslip net sum   : ₹${inr(Number(rawNet._sum.net))} ${netOk ? "PASS" : "FAIL"}`)
  console.log(`  raw payslip count     : ${rawNet._count} ${countOk ? "PASS" : "FAIL"}`)

  const salaryByDept = await getSalaryByDepartment(base)
  const deptSum = salaryByDept.reduce((n, d) => n + d.net, 0)
  console.log(
    `  department chart sums : ₹${inr(deptSum)} ${Math.abs(deptSum - kpis.totalNet) < 0.01 ? "PASS (matches KPI)" : "FAIL"}`,
  )

  console.log("\nSalary by department")
  for (const d of salaryByDept) {
    console.log(`  ${d.department.padEnd(14)} ${String(d.headcount).padStart(3)} staff  ₹${inr(d.net).padStart(12)}`)
  }

  const trend = await getMonthlyTrend(base)
  console.log("\nMonthly net salary trend")
  for (const t of trend) {
    console.log(`  ${t.label.padEnd(5)} ₹${inr(t.net).padStart(12)}  (${t.payslips} payslips)`)
  }

  const status = await getPayslipStatusSplit(base)
  console.log("\nPayslip status split")
  for (const s of status.split) console.log(`  ${s.status.padEnd(11)} ${s.count}`)
  console.log(`  alerts surfaced: ${status.alerts.length}`)
  for (const a of status.alerts.slice(0, 3)) {
    console.log(`    [${a.severity}] ${a.message}`)
  }

  const att = await getAttendanceOverview(base)
  console.log("\nAttendance overview")
  console.log(
    `  present ${att.present} · late ${att.late} · absent ${att.absent} · overtime records ${att.overtimeRecords}`,
  )
  console.log(
    `  missing check-outs ${att.missingCheckOuts} · manual edits ${att.manualEdits} · coverage ${att.coveragePct.toFixed(1)}%`,
  )

  const timeOff = await getTimeOffOverview(base)
  console.log("\nTime off overview")
  for (const t of timeOff) {
    console.log(
      `  ${t.type.padEnd(16)} approved ${String(t.approvedDays).padStart(5)} · pending ${t.pending} · remaining ${t.remainingBalance ?? "N/A"}`,
    )
  }

  const dept = await getDepartmentOverview(base)
  console.log("\nDepartment overview")
  for (const d of dept) {
    console.log(`  ${d.department.padEnd(14)} ${String(d.headcount).padStart(3)} staff  ₹${inr(d.monthlySalary).padStart(12)}/mo`)
  }

  // ── AC-M10-2 — filters must actually narrow the data ──
  console.log("\nAC-M10-2 — filters change every scoped figure")
  const finance = await db.department.findFirstOrThrow({
    where: { name: "Finance" },
    select: { id: true, name: true },
  })
  const filtered = await getKpis({ ...base, departmentId: finance.id })
  const filteredDept = await getDepartmentOverview({ ...base, departmentId: finance.id })
  console.log(`  all departments : ₹${inr(kpis.totalNet)} across ${kpis.payslipsGenerated} payslips`)
  console.log(
    `  Finance only    : ₹${inr(filtered.totalNet)} across ${filtered.payslipsGenerated} payslips`,
  )
  console.log(
    `  narrowed        : ${filtered.totalNet < kpis.totalNet && filtered.payslipsGenerated < kpis.payslipsGenerated ? "PASS" : "FAIL"}`,
  )
  console.log(
    `  department panel rows: ${filteredDept.length} ${filteredDept.length === 1 ? "PASS (only Finance)" : "FAIL"}`,
  )

  const interns = await getKpis({ ...base, employeeType: EmployeeType.INTERN })
  console.log(
    `  Interns only    : ₹${inr(interns.totalNet)} across ${interns.payslipsGenerated} payslips ${interns.payslipsGenerated < kpis.payslipsGenerated ? "PASS" : "FAIL"}`,
  )

  const emptyPeriod = await getKpis({
    ...base,
    periodStart: new Date(Date.UTC(2020, 0, 1)),
    periodEnd: new Date(Date.UTC(2020, 0, 31)),
  })
  console.log(
    `  Jan 2020 (empty): ₹${inr(emptyPeriod.totalNet)} across ${emptyPeriod.payslipsGenerated} payslips ${emptyPeriod.payslipsGenerated === 0 ? "PASS" : "FAIL"}`,
  )

  // ── AC-M10-4 — approving leave moves the KPI ──
  // The seeded pending requests sit in September, so test in that period.
  console.log("\nAC-M10-4 — approving a request moves the Approved Time Off KPI")
  const sept: DashboardFilters = {
    companyId: company.id,
    periodStart: new Date(Date.UTC(2026, 8, 1)),
    periodEnd: new Date(Date.UTC(2026, 8, 30, 23, 59, 59)),
  }
  const pending = await db.timeOffRequest.findFirst({
    where: {
      status: RequestStatus.TO_APPROVE,
      startDate: { lte: sept.periodEnd },
      endDate: { gte: sept.periodStart },
    },
    select: { id: true, duration: true },
  })
  if (!pending) {
    console.log("  no pending request inside September 2026 — skipped")
  } else {
    const before = (await getKpis(sept)).approvedTimeOffDays
    await db.timeOffRequest.update({
      where: { id: pending.id },
      data: { status: RequestStatus.APPROVED },
    })
    const after = (await getKpis(sept)).approvedTimeOffDays
    const delta = after - before
    console.log(
      `  ${before} → ${after} (+${delta}, request duration ${pending.duration}) ${Math.abs(delta - Number(pending.duration)) < 0.01 ? "PASS" : "FAIL"}`,
    )
    await db.timeOffRequest.update({
      where: { id: pending.id },
      data: { status: RequestStatus.TO_APPROVE },
    })
    const restored = (await getKpis(sept)).approvedTimeOffDays
    console.log(`  reverted → ${restored} ${restored === before ? "PASS" : "FAIL"}`)
  }

  console.log("\nAC-M10-3 — no hardcoded series: every figure above came from a query.")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
