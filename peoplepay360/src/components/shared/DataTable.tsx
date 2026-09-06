import Link from "next/link"
import { Surface } from "@/components/ui/surface"
import { cn } from "@/lib/utils"

export interface Column<T> {
  key: string
  header: string
  /** Right-aligns and applies tabular figures — use for every money/number column. */
  numeric?: boolean
  className?: string
  render: (row: T) => React.ReactNode
}

/**
 * Server-rendered table shell. Every list view uses this — do not hand-roll a
 * <table> per module (rules.md §9).
 */
export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowHref,
  empty,
  footer,
  caption,
}: {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowHref?: (row: T) => string
  empty?: React.ReactNode
  footer?: React.ReactNode
  /** Visually hidden table caption for screen readers, e.g. "Payslips". */
  caption?: string
}) {
  return (
    <Surface className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          {caption && <caption className="sr-only">{caption}</caption>}
          {/* Sticky within the scroll container, translucent so rows slide under it. */}
          <thead className="sticky top-0 z-10">
            <tr className="border-b border-border/70 bg-surface-muted/80 backdrop-blur-md">
              {columns.map((c) => (
                <th
                  key={c.key}
                  scope="col"
                  className={cn(
                    "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground",
                    c.numeric ? "text-right" : "text-left",
                    c.className,
                  )}
                >
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="stagger-rows">
            {rows.length === 0 && (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            )}
            {rows.map((row) => (
              <tr
                key={rowKey(row)}
                className="group h-11 border-b border-border/60 transition-colors duration-100 last:border-0 hover:bg-surface-hover/70"
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
                        i === 0 &&
                          "transition-shadow duration-150 group-hover:shadow-[inset_2px_0_0_0_var(--color-primary)]",
                        c.className,
                      )}
                    >
                      {/* The first cell carries the row link so the whole row is
                          reachable by keyboard without nesting interactive elements.
                          The underline draws in from the left on row hover. */}
                      {rowHref && i === 0 ? (
                        <Link
                          href={rowHref(row)}
                          className="block rounded-md font-medium text-foreground transition-colors duration-100 group-hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
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
      {footer && (
        <div className="flex items-center justify-end border-t border-border/70 bg-surface-muted/40 px-4 py-2 text-xs text-muted-foreground">
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
