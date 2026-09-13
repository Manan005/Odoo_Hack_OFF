import Link from "next/link"
import { Surface } from "@/components/ui/surface"
import { cn } from "@/lib/utils"

export type HideBelow = "sm" | "md" | "lg"

export interface Column<T> {
  key: string
  header: string
  /** Right-aligns and applies tabular figures — use for every money/number column. */
  numeric?: boolean
  /**
   * Drop the column below this breakpoint. The first column never hides — it
   * is the sticky identity cell a phone reads the row by.
   */
  hideBelow?: HideBelow
  className?: string
  render: (row: T) => React.ReactNode
}

/*
 * Tailwind only emits classes it can see, so each breakpoint maps to a literal
 * pair rather than a template string.
 */
const HIDE_BELOW: Record<HideBelow, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
}

/*
 * The first cell is pinned to the left while the rest scrolls under it, so it
 * needs an opaque background of its own: the row's hover tint does not reach
 * it otherwise. `.sticky-col` draws the hairline on its right edge once the
 * table has actually scrolled (primitives.css).
 */
const STICKY_CELL = "sticky-col sticky left-0 z-[1]"

/**
 * Server-rendered table shell. Every list view uses this — do not hand-roll a
 * <table> per module (rules.md §9).
 *
 * Below `minWidth` the table scrolls inside its Surface rather than wrapping
 * cells (rules.md §9: the page body never scrolls sideways), with the first
 * column pinned so every row stays identified while the rest slides under it.
 * Secondary columns declare `hideBelow` so a phone scrolls past two or three
 * columns rather than seven, and a tablet often needs no scroll at all.
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  footer,
  caption,
  minWidth = 640,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string
  empty?: React.ReactNode
  footer?: React.ReactNode
  /** Visually hidden table caption for screen readers, e.g. "Payslips". */
  caption?: string
  /** Width in px below which the table scrolls instead of wrapping its cells. */
  minWidth?: number
}) {
  return (
    <Surface className="overflow-hidden">
      <div data-table-scroll className="overflow-x-auto overscroll-x-contain">
        {/* The minimum applies from `sm` up, where enough columns show to need a
            contained scroll. On a phone `hideBelow` leaves two or three columns
            that fit the screen, and a forced 640px would only push them off to
            the right behind the pinned first cell. An empty list keeps its
            header but not the min-width: a scrollable strip of labels above an
            empty state reads as broken. */}
        <table
          className="w-full border-collapse sm:min-w-(--table-min)"
          style={{ ["--table-min" as string]: rows.length ? `${minWidth}px` : "0px" }}
        >
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr className="border-b border-border/70 bg-surface-muted">
              {columns.map((c, i) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    c.numeric ? "text-right" : "text-left",
                    i === 0 ? cn(STICKY_CELL, "bg-surface-muted") : c.hideBelow && HIDE_BELOW[c.hideBelow],
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="stagger-rows">
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="group h-11 border-b border-border/60 transition-colors duration-100 last:border-0 hover:bg-surface-hover"
              >
                {columns.map((c, i) => {
                  const content = c.render(row)
                  return (
                    <td
                      key={c.key}
                      className={cn(
                        "px-4 py-2.5 text-sm",
                        c.numeric && "text-right tabular",
                        // The accent bar lives on the first cell as an inset
                        // shadow — pseudo-elements on <tr> are unreliable.
                        i === 0
                          ? cn(
                              STICKY_CELL,
                              "bg-surface transition-[background-color,box-shadow] duration-150 group-hover:bg-surface-hover group-hover:shadow-[inset_2px_0_0_0_var(--color-primary)]",
                            )
                          : c.hideBelow && HIDE_BELOW[c.hideBelow],
                        c.className,
                      )}
                    >
                      {/* The first cell carries the row link so the whole row is
                          reachable by keyboard without nesting interactive elements.
                          The underline draws in from the left on row hover. The
                          negative margins let the link fill the cell, so a thumb
                          has the full 44px row height to hit, not one text line. */}
                      {rowHref && i === 0 ? (
                        <Link
                          href={rowHref(row)}
                          className="-mx-4 -my-2.5 block rounded-md px-4 py-2.5 font-medium text-foreground transition-colors duration-100 group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
                        >
                          <span className="link-draw inline-block max-w-full">{content}</span>
                        </Link>
                      ) : (
                        content
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Outside the scroller so it centres on the viewport, not on a 640px table. */}
      {rows.length === 0 && empty}
      {footer && (
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2 border-t border-border/70 bg-surface-muted/40 px-4 py-2 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </Surface>
  )
}

export function RowCount({ shown, total }: { shown: number; total: number }) {
  if (total === 0) return null
  return (
    <span className="tabular">
      1–{shown} / {total}
    </span>
  )
}
