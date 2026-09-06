import { ArrowUpRight, Mail } from "lucide-react"
import Link from "next/link"
import { Tilt } from "@/components/motion/Spotlight"
import { ActiveBadge } from "@/components/shared/StatusBadge"

export interface KanbanEmployee {
  id: string
  name: string
  initials: string
  position: string | null
  department: string | null
  workEmail: string | null
  active: boolean
}

/**
 * Kanban is for browsing; a card opens the same Employee Form the list opens
 * (AC-M1-1).
 *
 * Each card is a `Tilt` list item that leans toward the pointer and carries
 * a cursor glow; the Link fills it, so the whole card is one click and one
 * tab stop. The cascade (`.stagger`) stays on the list.
 */
export function EmployeeKanban({ employees }: { employees: KanbanEmployee[] }) {
  return (
    <ul className="stagger grid list-none gap-3 p-0 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
      {employees.map((e) => (
        <Tilt
          key={e.id}
          as="li"
          max={5}
          className="relative overflow-hidden rounded-2xl border border-border/70 bg-surface shadow-card transition-[translate,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raise"
        >
          <Link
            href={`/employees/${e.id}`}
            className="group relative flex h-full flex-col rounded-2xl p-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
          >
            <ArrowUpRight
              className="absolute right-3.5 top-3.5 h-4 w-4 -translate-x-1 translate-y-1 text-primary opacity-0 transition-[opacity,translate] duration-200 ease-out-quart group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
              aria-hidden
            />
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-sm font-semibold text-primary ring-1 ring-inset ring-primary/15 transition-colors duration-200 group-hover:bg-primary group-hover:text-primary-fg">
                {e.initials}
              </span>
              <div className="min-w-0 pr-5">
                <p className="truncate text-[15px] font-semibold tracking-tight">{e.name}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {[e.position, e.department].filter(Boolean).join(" • ") || "—"}
                </p>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between gap-3 border-t border-border/60 pt-3">
              <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground">
                <Mail className="h-3 w-3 shrink-0 text-subtle-foreground" aria-hidden />
                <span className="truncate">{e.workEmail ?? "—"}</span>
              </span>
              <ActiveBadge active={e.active} />
            </div>
          </Link>
        </Tilt>
      ))}
    </ul>
  )
}
