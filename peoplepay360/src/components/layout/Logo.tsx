import Link from "next/link"
import { cn } from "@/lib/utils"

/**
 * Brand mark: three ledger stripes — basic (primary), allowance (success),
 * deduction (danger) — the same colours the payslip breakdown uses.
 */
export function LogoMark({
  className,
  inverted,
}: {
  className?: string
  /** For the ink brand panel on the login page. */
  inverted?: boolean
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "group/mark relative inline-flex h-8 w-8 items-end justify-center gap-[3px] overflow-hidden rounded-[10px] pb-[7px]",
        inverted ? "bg-ink-fg" : "bg-foreground",
        className,
      )}
    >
      <span className="h-[9px] w-[3px] rounded-full bg-chart-1 transition-transform duration-300 ease-spring group-hover:-translate-y-0.5" />
      <span className="h-[15px] w-[3px] rounded-full bg-chart-5 transition-transform duration-300 ease-spring [transition-delay:40ms] group-hover:-translate-y-1" />
      <span className="h-[12px] w-[3px] rounded-full bg-chart-4 transition-transform duration-300 ease-spring [transition-delay:80ms] group-hover:-translate-y-0.5" />
    </span>
  )
}

export function Logo({
  href = "/",
  className,
  wordmark = true,
}: {
  href?: string
  className?: string
  wordmark?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex items-center gap-2.5 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
    >
      <LogoMark />
      {wordmark && (
        <span className="text-[15px] font-semibold tracking-tight">
          PeoplePay<span className="text-primary">360</span>
        </span>
      )}
    </Link>
  )
}
