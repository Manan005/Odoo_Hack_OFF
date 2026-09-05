import { cn } from "@/lib/utils"

const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]

/**
 * Odometer roll for any already-formatted number: "₹ 18.4L", "1,23,456.00",
 * "22 Days". Digits roll to their target with a per-digit delay; every other
 * character is static. Renders on the server — the animation is CSS only.
 *
 * Re-keying on `value` means a filter change rolls the new figure in.
 */
export function NumberTicker({
  value,
  className,
  delayStep = 40,
}: {
  value: string
  className?: string
  /** Milliseconds between one digit starting and the next. */
  delayStep?: number
}) {
  let digitIndex = 0
  return (
    <span key={value} className={cn("ticker tabular", className)}>
      <span className="sr-only">{value}</span>
      {[...value].map((ch, i) => {
        if (!/\d/.test(ch)) {
          return (
            <span key={i} aria-hidden>
              {ch === " " ? " " : ch}
            </span>
          )
        }
        const target = Number(ch)
        const d = digitIndex++
        return (
          <span key={i} className="ticker-digit" aria-hidden>
            <span
              className="ticker-col"
              style={{
                transform: `translateY(-${target}em)`,
                ["--d" as string]: `${d * delayStep}ms`,
              }}
            >
              {DIGITS.map((n) => (
                <span key={n}>{n}</span>
              ))}
            </span>
          </span>
        )
      })}
    </span>
  )
}
