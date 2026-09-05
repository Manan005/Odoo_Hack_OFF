/**
 * Backfill warnings for payruns created before the warning pass existed.
 * Safe to re-run — regenerateWarnings replaces a payrun's warning set.
 */
import { PrismaClient } from "@prisma/client"
import { regenerateWarnings } from "../src/lib/payroll/warnings"

const db = new PrismaClient()

async function main() {
  const runs = await db.payrun.findMany({
    select: { id: true, name: true },
    orderBy: { periodStart: "asc" },
  })

  for (const r of runs) {
    const res = await regenerateWarnings(r.id)
    console.log(`  ${r.name.padEnd(16)} ${res.total} warnings (${res.blocking} blocking)`)
  }

  const byCode = await db.payrollWarning.groupBy({ by: ["code"], _count: true })
  console.log("\nAcross all payruns:")
  for (const c of byCode.sort((a, b) => b._count - a._count)) {
    console.log(`  ${c.code.padEnd(22)} ${c._count}`)
  }
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
