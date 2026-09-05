/**
 * Gate — list pagination.
 *
 * The point of the buttons is that every row is reachable. That is only true
 * if walking the pages visits each row exactly once, which fails in two ways
 * that both look fine on page 1:
 *
 *   - an off-by-one in skip/take silently drops or repeats a row per boundary
 *   - a non-unique sort key lets Postgres order tied rows differently per
 *     query, so a row can appear on two pages, or on none
 *
 * So this walks every page of the largest table and compares the union against
 * the table itself. Runs offline — no dev server needed.
 */
import { PrismaClient } from "@prisma/client"
import { pageInfo, pageSlice, parsePage } from "../src/lib/paging"

const db = new PrismaClient()

let failures = 0
const check = (label: string, pass: boolean, detail = "") => {
  if (!pass) failures++
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`)
}

const PAGE_SIZE = 50

async function main() {
  // ── Page maths ──────────────────────────────────────────────────────
  console.log("Page arithmetic")
  const info = pageInfo(1, 50, 2858)
  check("58 pages for 2,858 rows at 50", info.pageCount === 58, `got ${info.pageCount}`)
  check("page 1 covers rows 1–50", info.from === 1 && info.to === 50)

  const p2 = pageInfo(2, 50, 2858)
  check("page 2 covers rows 51–100", p2.from === 51 && p2.to === 100)
  check("page 2 skips exactly 50", pageSlice(p2).skip === 50)

  const last = pageInfo(58, 50, 2858)
  check("the last page is short, not padded", last.from === 2851 && last.to === 2858)

  const exact = pageInfo(1, 50, 100)
  check("an exact multiple gives no empty trailing page", exact.pageCount === 2)

  const none = pageInfo(1, 50, 0)
  check("an empty table reports 0–0 over 1 page", none.from === 0 && none.to === 0 && none.pageCount === 1)

  // Anything a user can type into the address bar.
  console.log("\nOut-of-range and junk page params are clamped")
  check("?page=999999 lands on the last page", pageInfo(parsePage("999999"), 50, 2858).page === 58)
  check("?page=0 lands on the first", pageInfo(parsePage("0"), 50, 2858).page === 1)
  check("?page=-4 lands on the first", pageInfo(parsePage("-4"), 50, 2858).page === 1)
  check("?page=abc lands on the first", pageInfo(parsePage("abc"), 50, 2858).page === 1)
  check("?page=2.9 truncates to 2", parsePage("2.9") === 2)
  check("a missing param lands on the first", pageInfo(parsePage(undefined), 50, 2858).page === 1)

  // ── Walking every page of attendance ────────────────────────────────
  console.log("\nWalking every attendance page visits each row exactly once")
  const total = await db.attendance.count()
  const pages = pageInfo(1, PAGE_SIZE, total).pageCount
  console.log(`  ${total} rows · ${pages} pages of ${PAGE_SIZE}`)

  const seen = new Set<string>()
  let duplicates = 0
  let shortPages = 0

  for (let p = 1; p <= pages; p++) {
    const slice = pageSlice(pageInfo(p, PAGE_SIZE, total))
    const rows = await db.attendance.findMany({
      // Must match the page's orderBy exactly, tiebreaker included.
      orderBy: [{ checkIn: "desc" }, { id: "desc" }],
      ...slice,
      select: { id: true },
    })
    if (rows.length !== PAGE_SIZE && p !== pages) shortPages++
    for (const r of rows) {
      if (seen.has(r.id)) duplicates++
      seen.add(r.id)
    }
  }

  check("no row appears on two pages", duplicates === 0, `${duplicates} duplicates`)
  check("no page is short except the last", shortPages === 0, `${shortPages} short pages`)
  check(
    "every row is reachable",
    seen.size === total,
    `walked ${seen.size} of ${total}`,
  )

  const missing = total - seen.size
  if (missing !== 0) {
    const all = await db.attendance.findMany({ select: { id: true } })
    const lost = all.filter((r) => !seen.has(r.id)).slice(0, 5)
    console.log(`    unreachable ids: ${lost.map((r) => r.id).join(", ")}`)
  }

  // ── The tiebreaker actually matters ─────────────────────────────────
  console.log("\nThe sort tiebreaker is doing real work")
  const stamps = await db.attendance.findMany({ select: { checkIn: true } })
  const perStamp = new Map<number, number>()
  for (const s of stamps) {
    const t = s.checkIn.getTime()
    perStamp.set(t, (perStamp.get(t) ?? 0) + 1)
  }
  const shared = [...perStamp.values()].filter((n) => n > 1).length
  check(
    "rows do share a checkIn, so ordering by it alone is ambiguous",
    shared > 0,
    `${shared} timestamps are used by more than one row`,
  )

  // ── Payslips too ────────────────────────────────────────────────────
  console.log("\nPayslips paginate the same way")
  const slipTotal = await db.payslip.count()
  const slipPages = pageInfo(1, PAGE_SIZE, slipTotal).pageCount
  const slipSeen = new Set<string>()
  for (let p = 1; p <= slipPages; p++) {
    const rows = await db.payslip.findMany({
      orderBy: [
        { periodStart: "desc" },
        { employee: { firstName: "asc" } },
        { reference: "asc" },
      ],
      ...pageSlice(pageInfo(p, PAGE_SIZE, slipTotal)),
      select: { id: true },
    })
    for (const r of rows) slipSeen.add(r.id)
  }
  check(
    `every one of ${slipTotal} payslips is reachable across ${slipPages} pages`,
    slipSeen.size === slipTotal,
    `walked ${slipSeen.size}`,
  )

  console.log(
    failures === 0 ? "\nAll pagination checks passed." : `\n${failures} check(s) failed.`,
  )
  process.exit(failures === 0 ? 0 : 1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
