import { Prisma } from "@prisma/client"

/**
 * All money is Decimal. Never parseFloat, never Number(), never `+` on money.
 * See rules.md §3.
 */
export const Dec = Prisma.Decimal
export type Dec = Prisma.Decimal

export type DecimalLike = Prisma.Decimal | string | number

export const dec = (v: DecimalLike): Prisma.Decimal => new Prisma.Decimal(v)

export const ZERO = new Prisma.Decimal(0)

/** Round to 2dp — only at the end of a computation. */
export const money = (v: DecimalLike): Prisma.Decimal => dec(v).toDecimalPlaces(2)

export const sum = (values: DecimalLike[]): Prisma.Decimal =>
  values.reduce<Prisma.Decimal>((acc, v) => acc.plus(dec(v)), new Prisma.Decimal(0))

/** `base × pct / 100` — percentages are stored as the human number (50 = 50%). */
export const percentOf = (base: DecimalLike, pct: DecimalLike): Prisma.Decimal =>
  dec(base).times(dec(pct)).div(100)

// ───────────────────────────── Formatting ─────────────────────────────

const CURRENCY = process.env.COMPANY_CURRENCY ?? "INR"

const inrGroup = (digits: string): string => {
  // Indian grouping: last 3, then pairs — 8500000 → 85,00,000
  if (digits.length <= 3) return digits
  const head = digits.slice(0, -3)
  const tail = digits.slice(-3)
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`
}

/** `₹85,000.00` — forms and tables. */
export const formatINR = (v: DecimalLike | null | undefined, decimals = 2): string => {
  if (v === null || v === undefined) return "—"
  const d = dec(v)
  const negative = d.isNegative()
  const [int, frac = ""] = d.abs().toFixed(decimals).split(".")
  const body = inrGroup(int) + (decimals > 0 ? `.${frac}` : "")
  return `${negative ? "−" : ""}₹${body}`
}

/** `₹85,000` — compact list cells. */
export const formatMoneyCompact = (v: DecimalLike | null | undefined): string =>
  formatINR(v, 0)

/** `₹ 18.4L` / `₹ 1.2Cr` — KPI cards only. */
export const formatLakh = (v: DecimalLike | null | undefined): string => {
  if (v === null || v === undefined) return "—"
  const d = dec(v)
  const abs = d.abs()
  const sign = d.isNegative() ? "−" : ""
  if (abs.gte(10_000_000)) return `${sign}₹ ${abs.div(10_000_000).toFixed(1)}Cr`
  if (abs.gte(100_000)) return `${sign}₹ ${abs.div(100_000).toFixed(1)}L`
  if (abs.gte(1_000)) return `${sign}₹ ${abs.div(1_000).toFixed(1)}K`
  return `${sign}₹ ${abs.toFixed(0)}`
}

/** `20%`, `12.5%` */
export const formatPercent = (v: DecimalLike | null | undefined): string => {
  if (v === null || v === undefined) return "—"
  const d = dec(v)
  return `${d.equals(d.trunc()) ? d.toFixed(0) : d.toFixed(1)}%`
}

/** `9.08` — hours are always 2dp decimal hours, never `9:05`. */
export const formatHours = (v: DecimalLike | null | undefined): string =>
  v === null || v === undefined ? "—" : dec(v).toFixed(2)

/** `22 Days` / `3 Days` / `7.5 Hours` */
export const formatDuration = (
  v: DecimalLike | null | undefined,
  unit: "DAYS" | "HOURS" = "DAYS",
): string => {
  if (v === null || v === undefined) return "—"
  const d = dec(v)
  const n = d.equals(d.trunc()) ? d.toFixed(0) : d.toFixed(2)
  const noun = unit === "DAYS" ? "Day" : "Hour"
  return `${n} ${d.equals(1) ? noun : `${noun}s`}`
}

/** Payslip PDFs print the net in words. */
export function amountInWords(v: DecimalLike): string {
  const ones = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
    "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen",
    "Eighteen", "Nineteen",
  ]
  const tens = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
  ]

  const twoDigit = (n: number): string =>
    n < 20 ? ones[n] : `${tens[Math.floor(n / 10)]}${n % 10 ? ` ${ones[n % 10]}` : ""}`

  const threeDigit = (n: number): string => {
    const h = Math.floor(n / 100)
    const rest = n % 100
    return [h ? `${ones[h]} Hundred` : "", rest ? twoDigit(rest) : ""].filter(Boolean).join(" ")
  }

  const d = money(v)
  const rupees = d.trunc().toNumber()
  const paise = d.minus(d.trunc()).times(100).round().toNumber()

  if (rupees === 0 && paise === 0) return "Zero Rupees Only"

  // Indian numbering: crore, lakh, thousand, hundred
  const units: Array<[number, string]> = [
    [10_000_000, "Crore"],
    [100_000, "Lakh"],
    [1_000, "Thousand"],
  ]

  let remaining = rupees
  const parts: string[] = []
  for (const [value, label] of units) {
    const count = Math.floor(remaining / value)
    if (count > 0) {
      parts.push(`${threeDigit(count)} ${label}`)
      remaining %= value
    }
  }
  if (remaining > 0) parts.push(threeDigit(remaining))

  const rupeeWords = parts.length ? `${parts.join(" ")} Rupees` : ""
  const paiseWords = paise > 0 ? `${twoDigit(paise)} Paise` : ""
  return [rupeeWords, paiseWords].filter(Boolean).join(" and ") + " Only"
}
