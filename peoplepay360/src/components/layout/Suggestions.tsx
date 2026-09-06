import { ArrowUpRight } from "lucide-react"
import Link from "next/link"
import type { Command } from "@/components/layout/commands"

/** One destination per section, up to four — the user's own role-gated tree. */
function pick(commands: Command[], limit = 4): Command[] {
  const nav = commands.filter((c) => c.group === "Navigate")
  const seen = new Set<string>()
  const out: Command[] = []
  for (const c of nav) {
    const key = c.section ?? c.label
    if (seen.has(key)) continue
    seen.add(key)
    out.push(c)
    if (out.length === limit) break
  }
  for (const c of nav) {
    if (out.length === limit) break
    if (!out.includes(c)) out.push(c)
  }
  return out
}

/** Suggested destinations for the status pages. Server-safe: plain links. */
export function Suggestions({ commands }: { commands: Command[] }) {
  const picks = pick(commands)
  if (picks.length === 0) return null
  return (
    <div>
      <p className="mb-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-subtle-foreground">
        Or jump to
      </p>
      <ul className="stagger grid grid-cols-2 gap-2 text-left sm:grid-cols-4">
        {picks.map((c) => (
          <li key={c.id}>
            <Link
              href={c.href}
              className="group flex h-full flex-col justify-between gap-3 rounded-xl border border-border/70 bg-surface p-3 shadow-card transition-[transform,box-shadow,border-color] duration-200 ease-out-quart hover:-translate-y-0.5 hover:border-border-strong hover:shadow-raise focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium leading-tight text-foreground">{c.label}</span>
                <ArrowUpRight
                  className="h-3.5 w-3.5 shrink-0 text-subtle-foreground transition-[transform,color] duration-200 ease-out-quart group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                  aria-hidden
                />
              </span>
              {c.section && (
                <span className="text-[11px] uppercase tracking-wider text-subtle-foreground">
                  {c.section}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
