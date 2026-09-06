import type { NavItem } from "@/lib/nav"

/*
 * Command-palette source. This module is deliberately dependency-free (only a
 * type import) so the client island can derive commands from the nav tree it
 * already holds. `src/lib/nav.ts` re-exports it for server callers — it cannot
 * host the implementation itself because its import chain reaches auth-guard
 * → @/auth → Prisma, none of which may enter a client bundle.
 *
 * Presentation only: every route still enforces its own role (rules.md §4).
 */

export type CommandGroup = "Navigate" | "Create"

export interface Command {
  id: string
  label: string
  href: string
  group: CommandGroup
  keywords: string[]
  /** Parent section label, shown as a trailing crumb in the palette. */
  section?: string
}

interface CreateRoute {
  /** The list route that must be in the user's tree for this to appear. */
  list: string
  label: string
  keywords: string[]
  /**
   * A second route that must also be visible. Used where the list itself is
   * open to everyone but creating requires a higher role — the tree is the
   * only role signal available here, so a role-gated sibling stands in.
   */
  requires?: string
}

const CREATE_ROUTES: CreateRoute[] = [
  { list: "/employees", label: "New employee", keywords: ["add", "hire", "person", "staff"] },
  { list: "/contracts", label: "New contract", keywords: ["add", "wage", "agreement"] },
  { list: "/attendance", label: "New attendance record", keywords: ["add", "check in", "hours"] },
  { list: "/time-off/requests", label: "New time off request", keywords: ["add", "leave", "holiday", "pto"] },
  {
    list: "/time-off/allocations",
    label: "New allocation",
    keywords: ["add", "leave", "balance", "days"],
    requires: "/time-off/types",
  },
  { list: "/time-off/types", label: "New time off type", keywords: ["add", "leave", "category"] },
  { list: "/payroll/structures", label: "New salary structure", keywords: ["add", "payroll", "structure"] },
  { list: "/payroll/rules", label: "New salary rule", keywords: ["add", "payroll", "formula", "allowance", "deduction"] },
  { list: "/working-schedules", label: "New working schedule", keywords: ["add", "shift", "hours", "week"] },
  { list: "/users", label: "New user", keywords: ["add", "account", "login", "role"] },
]

const words = (s: string) => s.toLowerCase().split(/[\s/]+/).filter(Boolean)

/**
 * Flattens the role-gated nav tree into palette commands: one Navigate
 * command per leaf (children carry the parent label as a keyword) and one
 * Create command per `/new` route whose list is visible in the tree.
 */
export function commandsFor(items: NavItem[]): Command[] {
  const navigate: Command[] = []
  const seen = new Set<string>()

  const push = (item: NavItem, section?: string) => {
    if (seen.has(item.href)) return
    seen.add(item.href)
    navigate.push({
      id: `nav:${item.href}`,
      label: item.label,
      href: item.href,
      group: "Navigate",
      section,
      keywords: [...words(item.label), ...(section ? words(section) : []), ...words(item.href)],
    })
  }

  for (const item of items) {
    if (item.children?.length) {
      for (const child of item.children) push(child, item.label)
    } else {
      push(item)
    }
  }

  const create: Command[] = CREATE_ROUTES.filter(
    (r) => seen.has(r.list) && (!r.requires || seen.has(r.requires)),
  ).map((r) => ({
    id: `new:${r.list}`,
    label: r.label,
    href: `${r.list}/new`,
    group: "Create",
    keywords: ["new", "create", ...r.keywords, ...words(r.list)],
  }))

  return [...navigate, ...create]
}
