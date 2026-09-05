import { ArrowUpRight, Mail } from "lucide-react"
import Link from "next/link"
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
 */
export function EmployeeKanban({ employees }: { employees: KanbanEmployee[] }) {
  return (
    <div className="stagger grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(250px,1fr))]">
      {employees.map((e) => (
        <Link
          key={e.id}
          href={`/employees/${e.id}`}
          className="group relative flex flex-col rounded-2xl border border-border/70 bg-surface p-4 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-raise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        >
          <ArrowUpRight
            className="absolute right-3.5 top-3.5 h-4 w-4 -translate-x-1 translate-y-1 text-primary opacity-0 transition-[opacity,transform] duration-200 ease-out-quart group-hover:translate-x-0 group-hover:translate-y-0 group-hover:opacity-100"
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
      ))}
    </div>
  )
}
