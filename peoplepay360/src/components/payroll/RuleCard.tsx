import type { RuleCategory } from "@prisma/client"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CATEGORY_LABEL, COMPUTATION_LABEL } from "@/lib/validation/payroll"
import { CopyChip } from "./CopyChip"
import { CATEGORY_CHIP, CATEGORY_RAIL, ruleExpression, type RuleShape } from "./rule-describe"

export interface RuleCardRule extends RuleShape {
  id: string
  name: string
  code: string
  category: RuleCategory
  sequence: number
  condition: string | null
  active: boolean
}

/**
 * One salary rule as a card: sequence on a rail, category tone, the
 * expression in a copyable mono chip. Reads stored columns only.
 */
export function RuleCard({
  rule,
  href,
  actionLabel,
}: {
  rule: RuleCardRule
  href: string
  actionLabel: string
}) {
  return (
    <li
      className={cn(
        "flex overflow-hidden rounded-xl border border-border/70 bg-surface shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise",
        !rule.active && "opacity-60",
      )}
    >
      <div className="rule-seq relative shrink-0 text-sm font-semibold text-muted-foreground">
        <span
          aria-hidden
          className={cn("absolute inset-y-0 left-0 w-[3px]", CATEGORY_RAIL[rule.category])}
        />
        <span className="sr-only">Sequence </span>
        {rule.sequence}
      </div>

      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={href}
              className="text-sm font-medium transition-colors duration-100 hover:text-primary"
            >
              {rule.name}
            </Link>
            <span className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11.5px] text-muted-foreground ring-1 ring-inset ring-border/70">
              {rule.code}
            </span>
            <span
              className={cn(
                "rounded-md px-1.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
                CATEGORY_CHIP[rule.category],
              )}
            >
              {CATEGORY_LABEL[rule.category]}
            </span>
            {!rule.active && (
              <span className="text-[11px] font-medium uppercase tracking-wide text-subtle-foreground">
                inactive
              </span>
            )}
          </div>
          <p className="mt-1 text-[11.5px] text-muted-foreground">
            {COMPUTATION_LABEL[rule.computationType]}
            {rule.condition && (
              <>
                {" "}
                · when <code className="font-mono text-foreground/80">{rule.condition}</code>
              </>
            )}
          </p>
        </div>

        <CopyChip text={ruleExpression(rule)} className="max-w-xs" />

        <Link href={href} className="text-xs font-medium text-primary hover:underline">
          {actionLabel}
        </Link>
      </div>
    </li>
  )
}
