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
    <div className="flex flex-wrap gap-4 rounded-b-lg border border-border bg-surface p-4 shadow-card">
      {employees.map((e) => (
        <Link
          key={e.id}
          href={`/employees/${e.id}`}
          className="w-[260px] rounded-lg border border-border bg-surface p-4 shadow-card transition-shadow hover:shadow-raise"
        >
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-subtle text-sm font-semibold text-primary">
              {e.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[15px] font-semibold">{e.name}</p>
              <p className="truncate text-xs text-muted-foreground">
                {[e.position, e.department].filter(Boolean).join(" • ") || "—"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between">
            <span className="truncate text-xs text-muted-foreground">{e.workEmail ?? "—"}</span>
            <ActiveBadge active={e.active} />
          </div>
        </Link>
      ))}
    </div>
  )
}
