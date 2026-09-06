"use client"

import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarClock,
  CalendarDays,
  Calculator,
  Clock,
  CornerDownLeft,
  FileText,
  History,
  Layers,
  LayoutDashboard,
  type LucideIcon,
  Monitor,
  Moon,
  Plus,
  Receipt,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Tags,
  Users,
  Wallet,
} from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import {
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react"
import type { Command } from "@/components/layout/commands"
import { useTheme, type Theme } from "@/components/theme/ThemeProvider"
import { cn } from "@/lib/utils"

/** Any surface can open the palette by dispatching this on `window`. */
export const PALETTE_EVENT = "pp360:palette"
export function requestPalette() {
  window.dispatchEvent(new CustomEvent(PALETTE_EVENT))
}

const RECENT_KEY = "pp360-recent"
const MAX_RECENT = 5
const MAX_RESULTS = 14

type Bucket = "Recent" | "Navigate" | "Create" | "Appearance"

interface Entry {
  id: string
  label: string
  group: Exclude<Bucket, "Recent">
  keywords: string[]
  section?: string
  href?: string
  theme?: Theme
}

interface Hit {
  entry: Entry
  bucket: Bucket
  positions: number[]
}

const APPEARANCE: Entry[] = [
  { id: "theme:light", label: "Light appearance", group: "Appearance", keywords: ["theme", "light", "day", "paper", "mode"], theme: "light" },
  { id: "theme:dark", label: "Dark appearance", group: "Appearance", keywords: ["theme", "dark", "night", "ink", "mode"], theme: "dark" },
  { id: "theme:system", label: "Match system appearance", group: "Appearance", keywords: ["theme", "auto", "system", "os", "mode"], theme: "system" },
]

const BUCKET_ORDER: Bucket[] = ["Recent", "Navigate", "Create", "Appearance"]

// ───────────────────────────── Matching ─────────────────────────────

/**
 * Subsequence scorer: every query character must appear in order. Word
 * starts score highest, then runs of adjacent characters; each skipped
 * character costs a little so tighter matches float up.
 */
function fuzzy(q: string, text: string): { score: number; positions: number[] } | null {
  const t = text.toLowerCase()
  const positions: number[] = []
  let from = 0
  let prev = -2
  let score = 0
  for (const ch of q) {
    if (ch === " ") continue
    const idx = t.indexOf(ch, from)
    if (idx === -1) return null
    if (idx === 0 || t[idx - 1] === " " || t[idx - 1] === "/") score += 3
    else if (idx === prev + 1) score += 2
    else score += 1
    score -= (idx - from) * 0.1
    positions.push(idx)
    prev = idx
    from = idx + 1
  }
  if (t.startsWith(q)) score += 4
  return { score, positions }
}

function match(entry: Entry, q: string): { score: number; positions: number[] } | null {
  const direct = fuzzy(q, entry.label)
  if (direct) return direct
  if (entry.section) {
    const combo = fuzzy(q, `${entry.section} ${entry.label}`)
    if (combo) {
      const off = entry.section.length + 1
      return {
        score: combo.score - 1,
        positions: combo.positions.filter((p) => p >= off).map((p) => p - off),
      }
    }
  }
  if (entry.keywords.some((k) => k.startsWith(q))) return { score: 2.5, positions: [] }
  if (entry.keywords.some((k) => k.includes(q))) return { score: 1.5, positions: [] }
  const loose = fuzzy(q, entry.keywords.join(" "))
  return loose ? { score: loose.score * 0.4, positions: [] } : null
}

// ───────────────────────────── Recents ─────────────────────────────

function readRecents(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : []
  } catch {
    return []
  }
}

function remember(id: string) {
  try {
    const next = [id, ...readRecents().filter((v) => v !== id)].slice(0, MAX_RECENT)
    localStorage.setItem(RECENT_KEY, JSON.stringify(next))
  } catch {
    // Storage may be unavailable (private mode, quota); recents are a nicety.
  }
}

// ───────────────────────────── Platform key ─────────────────────────────

const noop = () => () => {}
const clientMod = () => (/Mac|iPhone|iPad/.test(navigator.userAgent) ? "⌘" : "Ctrl")
const serverMod = () => "Ctrl"

/** "⌘" on Apple platforms, "Ctrl" elsewhere — hydration-safe. */
export function useModKey(): string {
  return useSyncExternalStore(noop, clientMod, serverMod)
}

// ───────────────────────────── Icons ─────────────────────────────

const ICONS: Array<[prefix: string, icon: LucideIcon]> = [
  ["/employees", Users],
  ["/departments", Building2],
  ["/job-positions", Briefcase],
  ["/contracts", FileText],
  ["/working-schedules", CalendarClock],
  ["/attendance", Clock],
  ["/time-off/types", Tags],
  ["/time-off", CalendarDays],
  ["/payroll/dashboard", LayoutDashboard],
  ["/payroll/payslips", Receipt],
  ["/payroll/simulator", Calculator],
  ["/payroll/structures", Layers],
  ["/payroll/rules", SlidersHorizontal],
  ["/payroll", Wallet],
  ["/users", ShieldCheck],
]

function iconFor(entry: Entry): LucideIcon {
  if (entry.theme === "light") return Sun
  if (entry.theme === "dark") return Moon
  if (entry.theme === "system") return Monitor
  if (entry.group === "Create") return Plus
  const href = entry.href
  const found = href ? ICONS.find(([p]) => href.startsWith(p)) : undefined
  return found ? found[1] : ArrowRight
}

// ───────────────────────────── Pieces ─────────────────────────────

function Highlight({ text, positions }: { text: string; positions: number[] }) {
  if (positions.length === 0) return <>{text}</>
  const hits = new Set(positions)
  const out: React.ReactNode[] = []
  let buf = ""
  let inHit = false
  const flush = () => {
    if (!buf) return
    out.push(
      inHit ? (
        <mark key={out.length} className="palette-hit">
          {buf}
        </mark>
      ) : (
        <span key={out.length}>{buf}</span>
      ),
    )
    buf = ""
  }
  for (let i = 0; i < text.length; i++) {
    const h = hits.has(i)
    if (h !== inHit) {
      flush()
      inHit = h
    }
    buf += text[i]
  }
  flush()
  return <>{out}</>
}

/** Search-shaped button for the island. Opens the palette via the event bus. */
export function PaletteTrigger({ className }: { className?: string }) {
  const mod = useModKey()
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label="Search and jump to anything"
      onClick={requestPalette}
      className={cn(
        "group/trigger inline-flex h-9 items-center gap-2 rounded-lg border border-border/70 bg-surface-muted/70 pl-2.5 pr-1.5 text-[13px] text-muted-foreground",
        "transition-[background-color,border-color,color,transform] duration-150 ease-out-quart",
        "hover:border-border-strong hover:bg-surface-hover hover:text-foreground active:scale-[0.98]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        className,
      )}
    >
      <Search className="h-4 w-4 shrink-0" aria-hidden />
      <span className="hidden xl:inline">Search…</span>
      <span className="hidden items-center gap-0.5 lg:inline-flex" aria-hidden>
        <kbd className="kbd">{mod}</kbd>
        <kbd className="kbd">K</kbd>
      </span>
    </button>
  )
}

// ───────────────────────────── Palette ─────────────────────────────

export function CommandPalette({ commands }: { commands: Command[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const { setTheme } = useTheme()
  const mod = useModKey()

  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [active, setActive] = useState(0)
  const [recents, setRecents] = useState<string[]>([])

  const entries = useMemo<Entry[]>(() => [...commands, ...APPEARANCE], [commands])

  const hits = useMemo<Hit[]>(() => {
    const q = query.trim().toLowerCase()
    if (!q) {
      // Browse mode: recents first, then the whole tree by section.
      const recent = recents
        .map((id) => entries.find((e) => e.id === id))
        .filter((e): e is Entry => Boolean(e))
        .map((entry) => ({ entry, bucket: "Recent" as const, positions: [] }))
      return [...recent, ...entries.map((entry) => ({ entry, bucket: entry.group, positions: [] }))]
    }
    return entries
      .map((entry) => ({ entry, m: match(entry, q) }))
      .filter((x): x is { entry: Entry; m: { score: number; positions: number[] } } => x.m !== null)
      .sort((a, b) => b.m.score - a.m.score)
      .slice(0, MAX_RESULTS)
      .map(({ entry, m }) => ({ entry, bucket: entry.group, positions: m.positions }))
  }, [query, entries, recents])

  // Display order is by bucket; the keyboard index runs across the flat list,
  // so each section carries the offset its first row starts at.
  const sections = useMemo(() => {
    const out: Array<{ bucket: Bucket; rows: Hit[]; offset: number }> = []
    let offset = 0
    for (const bucket of BUCKET_ORDER) {
      const rows = hits.filter((h) => h.bucket === bucket)
      if (rows.length === 0) continue
      out.push({ bucket, rows, offset })
      offset += rows.length
    }
    return out
  }, [hits])
  const ordered = useMemo(() => sections.flatMap((s) => s.rows), [sections])

  const openPalette = useCallback(() => {
    setRecents(readRecents())
    setQuery("")
    setActive(0)
    setOpen(true)
  }, [])
  const closePalette = useCallback(() => setOpen(false), [])

  // The <dialog> mirrors `open`; focus lands on the input once it is modal.
  useEffect(() => {
    const el = dialogRef.current
    if (!el) return
    if (open && !el.open) {
      el.showModal()
      inputRef.current?.focus()
    }
    if (!open && el.open) el.close()
  }, [open])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "k" || e.key === "K")) {
        e.preventDefault()
        if (dialogRef.current?.open) closePalette()
        else openPalette()
      }
    }
    const onRequest = () => openPalette()
    document.addEventListener("keydown", onKey)
    window.addEventListener(PALETTE_EVENT, onRequest)
    return () => {
      document.removeEventListener("keydown", onKey)
      window.removeEventListener(PALETTE_EVENT, onRequest)
    }
  }, [openPalette, closePalette])

  const run = (entry: Entry) => {
    remember(entry.id)
    closePalette()
    if (entry.theme) setTheme(entry.theme)
    else if (entry.href) {
      const href = entry.href
      startTransition(() => router.push(href))
    }
  }

  const moveTo = (index: number) => {
    setActive(index)
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${index}"]`)
      ?.scrollIntoView({ block: "nearest" })
  }

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const n = ordered.length
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault()
        if (n) moveTo((active + 1) % n)
        break
      case "ArrowUp":
        e.preventDefault()
        if (n) moveTo((active - 1 + n) % n)
        break
      case "Tab":
        e.preventDefault()
        if (n) moveTo(e.shiftKey ? (active - 1 + n) % n : (active + 1) % n)
        break
      case "Home":
        if (n) {
          e.preventDefault()
          moveTo(0)
        }
        break
      case "End":
        if (n) {
          e.preventDefault()
          moveTo(n - 1)
        }
        break
      case "Enter": {
        e.preventDefault()
        const hit = ordered[active]
        if (hit) run(hit.entry)
        break
      }
    }
  }

  const isCurrent = (entry: Entry) =>
    Boolean(entry.href) &&
    (pathname === entry.href ||
      (entry.group === "Navigate" && pathname.startsWith(`${entry.href}/`)))

  const activeId = ordered.length ? `pp360-opt-${Math.min(active, ordered.length - 1)}` : undefined

  return (
    <dialog
      ref={dialogRef}
      className="palette"
      aria-label="Command palette"
      onClose={closePalette}
      onClick={(e) => {
        if (e.target === e.currentTarget) closePalette()
      }}
    >
      <div className="flex h-12 items-center gap-3 border-b border-border/70 px-4">
        <Search className="h-4 w-4 shrink-0 text-subtle-foreground" aria-hidden />
        <input
          ref={inputRef}
          role="combobox"
          aria-expanded="true"
          aria-controls="pp360-palette-list"
          aria-activedescendant={activeId}
          aria-autocomplete="list"
          aria-label="Search commands"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          placeholder="Jump to a page, create a record, change appearance…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setActive(0)
          }}
          onKeyDown={onInputKey}
          className="h-full min-w-0 flex-1 bg-transparent text-[15px] text-foreground placeholder:text-subtle-foreground focus:outline-none"
        />
        <kbd className="kbd" aria-hidden>
          esc
        </kbd>
      </div>

      <div
        ref={listRef}
        id="pp360-palette-list"
        role="listbox"
        aria-label="Results"
        onMouseDown={(e) => e.preventDefault()}
        className="max-h-[min(60vh,26rem)] overflow-y-auto overscroll-contain p-1.5"
      >
        {ordered.length === 0 && (
          <div className="px-3 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No matches for <span className="font-medium text-foreground">“{query.trim()}”</span>
            </p>
            <p className="mt-1 text-xs text-subtle-foreground">
              Try a section name like payroll or time off.
            </p>
          </div>
        )}

        {/* Rendered per bucket so the listbox carries real group semantics. */}
        {sections.map(({ bucket, rows, offset }) => {
          const headingId = `pp360-group-${bucket}`
          return (
            <div key={bucket} role="group" aria-labelledby={headingId} className="mb-1 last:mb-0">
              <div
                id={headingId}
                role="presentation"
                className="flex items-center gap-1.5 px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-[0.12em] text-subtle-foreground"
              >
                {bucket === "Recent" && <History className="h-3 w-3" aria-hidden />}
                {bucket}
              </div>
              {rows.map(({ entry, positions }, j) => {
                const i = offset + j
                const Icon = iconFor(entry)
                const current = isCurrent(entry)
                const selected = i === active
                return (
                  <div
                    key={`${bucket}:${entry.id}`}
                    id={`pp360-opt-${i}`}
                    role="option"
                    aria-selected={selected}
                    aria-current={current ? "page" : undefined}
                    data-index={i}
                    onPointerMove={() => {
                      if (active !== i) setActive(i)
                    }}
                    onClick={() => run(entry)}
                    className="palette-option flex h-10 cursor-pointer items-center gap-3 rounded-lg px-2.5 text-sm text-foreground"
                  >
                    <span
                      className={cn(
                        "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md ring-1 ring-inset",
                        selected
                          ? "bg-primary/10 text-primary ring-primary/20"
                          : "bg-surface-muted text-muted-foreground ring-border/60",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="min-w-0 flex-1 truncate">
                      <Highlight text={entry.label} positions={positions} />
                      {entry.section && (
                        <span className="ml-2 text-xs text-subtle-foreground">{entry.section}</span>
                      )}
                    </span>
                    {current && (
                      <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-subtle-foreground ring-1 ring-inset ring-border/60">
                        Current
                      </span>
                    )}
                    <CornerDownLeft
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-primary transition-opacity duration-100",
                        selected ? "opacity-100" : "opacity-0",
                      )}
                      aria-hidden
                    />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <footer className="flex items-center justify-between border-t border-border/70 bg-surface-muted/50 px-3 py-2 text-[11px] text-subtle-foreground">
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">↵</kbd>
            open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="kbd">esc</kbd>
            close
          </span>
        </span>
        <span className="flex items-center gap-1">
          <kbd className="kbd">{mod}</kbd>
          <kbd className="kbd">K</kbd>
          toggles
        </span>
      </footer>
    </dialog>
  )
}
