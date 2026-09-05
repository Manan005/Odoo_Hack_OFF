import { Construction } from "lucide-react"
import Link from "next/link"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/surface"

/**
 * Placeholder for routes the nav already points at but a later phase builds.
 * Delete each usage as its phase lands — see docs/phases.md.
 */
export function ComingInPhase({
  title,
  phase,
  hours,
  description,
  buildsOn,
}: {
  title: string
  phase: string
  hours: string
  description: string
  buildsOn?: string[]
}) {
  return (
    <>
      <StatusPage
        icon={Construction}
        tone="warning"
        title={title}
        message={description}
        actions={
          <>
            <span className="inline-flex items-center rounded-md bg-warning-subtle px-3 py-1.5 text-xs font-medium text-warning ring-1 ring-inset ring-warning/25">
              Scheduled for {phase} · hours {hours}
            </span>
            <Link href="/employees">
              <Button variant="outline">Go to Employees</Button>
            </Link>
          </>
        }
      />

      {buildsOn && buildsOn.length > 0 && (
        <Surface padded className="mx-auto -mt-12 w-full max-w-md text-left">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Depends on
          </p>
          <ul className="space-y-1 text-[13px] text-muted-foreground">
            {buildsOn.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <span aria-hidden className="h-1 w-1 rounded-full bg-border-strong" />
                {item}
              </li>
            ))}
          </ul>
        </Surface>
      )}
    </>
  )
}
