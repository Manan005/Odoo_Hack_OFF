import { Construction } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

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
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <Construction className="h-9 w-9 text-warning" />
      <h1 className="mt-4 text-xl font-semibold">{title}</h1>
      <p className="mt-1 max-w-lg text-sm text-muted-foreground">{description}</p>

      <span className="mt-4 inline-flex items-center gap-2 rounded-md bg-warning-subtle px-3 py-1.5 text-xs font-medium text-warning">
        Scheduled for {phase} · hours {hours}
      </span>

      {buildsOn && buildsOn.length > 0 && (
        <div className="mt-5 w-full max-w-md rounded-lg border border-border bg-surface p-4 text-left">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Depends on
          </p>
          <ul className="space-y-1 text-[13px] text-muted-foreground">
            {buildsOn.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </div>
      )}

      <Link href="/employees" className="mt-5">
        <Button variant="outline">Go to Employees</Button>
      </Link>
    </div>
  )
}
