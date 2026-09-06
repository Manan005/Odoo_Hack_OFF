"use client"

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useSearchParamWriter } from "@/components/shared/ListToolbar"
import { NumberTicker } from "@/components/ui/number-ticker"
import type { PageInfo } from "@/lib/paging"
import { cn } from "@/lib/utils"

const nf = new Intl.NumberFormat("en-IN")

function PageButton({
  label,
  icon: Icon,
  to,
  disabled,
}: {
  label: string
  icon: typeof ChevronLeft
  to: number
  disabled: boolean
}) {
  const write = useSearchParamWriter()
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      // Page 1 drops the param entirely so the canonical first page has a
      // clean URL rather than "?page=1".
      onClick={() => write({ page: to === 1 ? null : String(to) })}
      className={cn(
        "inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/80 bg-surface",
        "transition-[background-color,border-color,color,scale] duration-150 ease-out-quart",
        disabled
          ? "cursor-not-allowed text-subtle-foreground opacity-50"
          : "text-muted-foreground hover:border-border-strong hover:bg-surface-hover hover:text-foreground active:scale-95",
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
}

/**
 * Table footer: the visible range, and controls to reach every other row.
 * The range rolls in (it is a real count) and "Page x of y" fades on change.
 *
 * When everything fits on one page the controls are omitted — buttons that can
 * never do anything are just noise.
 */
export function Pagination({ info }: { info: PageInfo }) {
  if (info.total === 0) return null

  const single = info.pageCount <= 1

  return (
    <div className="flex w-full items-center justify-end gap-4">
      <NumberTicker
        value={`${nf.format(info.from)}–${nf.format(info.to)} / ${nf.format(info.total)}`}
        delayStep={25}
      />

      {!single && (
        <div className="flex items-center gap-2">
          <span key={info.page} className="animate-fade-in tabular text-subtle-foreground">
            Page {nf.format(info.page)} of {nf.format(info.pageCount)}
          </span>
          <div className="flex items-center gap-1">
            <PageButton
              label="First page"
              icon={ChevronsLeft}
              to={1}
              disabled={info.page === 1}
            />
            <PageButton
              label="Previous page"
              icon={ChevronLeft}
              to={info.page - 1}
              disabled={info.page === 1}
            />
            <PageButton
              label="Next page"
              icon={ChevronRight}
              to={info.page + 1}
              disabled={info.page === info.pageCount}
            />
            <PageButton
              label="Last page"
              icon={ChevronsRight}
              to={info.pageCount}
              disabled={info.page === info.pageCount}
            />
          </div>
        </div>
      )}
    </div>
  )
}
