"use client"

import { Plus, Search, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { buttonVariants } from "@/components/ui/button"
import { Input } from "@/components/ui/field"
import { Segmented } from "@/components/ui/segmented"
import { cn } from "@/lib/utils"

/**
 * Filters live in the URL, not component state (rules.md §2.4) — so smart
 * buttons are plain links and a filtered view survives refresh and sharing.
 */
export function useSearchParamWriter() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  return (patch: Record<string, string | null>) => {
    const next = new URLSearchParams(params.toString())
    for (const [key, value] of Object.entries(patch)) {
      if (value === null || value === "") next.delete(key)
      else next.set(key, value)
    }
    // Any filter change resets pagination.
    if (!("page" in patch)) next.delete("page")
    router.push(`${pathname}?${next.toString()}`)
  }
}

/*
 * A phone-sized hit box (40px) on a control that stays visually small: the
 * pseudo-element takes the taps, the button keeps its 20–22px face and hover
 * tint. Dropped from `sm` up, where a pointer is precise and the chips sit
 * close enough that an invisible halo would steal clicks from a neighbour.
 */
const PHONE_HIT = "relative max-sm:before:absolute max-sm:before:content-['']"

export function FilterChip({ label, paramKey }: { label: string; paramKey: string }) {
  const write = useSearchParamWriter()
  return (
    <span className="inline-flex h-8 animate-scale-in items-center gap-1 rounded-lg bg-primary-subtle pl-2.5 pr-1 text-xs font-medium text-primary ring-1 ring-inset ring-primary/15">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={() => write({ [paramKey]: null })}
        className={cn(
          "rounded-md p-1 transition-colors duration-100 hover:bg-primary/15 active:scale-90",
          PHONE_HIT,
          "max-sm:before:-inset-2.5",
        )}
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
    </span>
  )
}

function SearchBox({ placeholder, className }: { placeholder: string; className?: string }) {
  const params = useSearchParams()
  const write = useSearchParamWriter()
  const urlValue = params.get("q") ?? ""
  const [value, setValue] = useState(urlValue)
  const [seenUrlValue, setSeenUrlValue] = useState(urlValue)
  const inputRef = useRef<HTMLInputElement>(null)

  // When the URL changes underneath us (a chip removed, back navigation),
  // adopt it — done during render, the documented way to derive state from
  // a changed prop without an effect.
  if (urlValue !== seenUrlValue) {
    setSeenUrlValue(urlValue)
    setValue(urlValue)
  }

  // Debounce so typing does not fire a navigation per keystroke.
  useEffect(() => {
    if (value === urlValue) return
    const t = setTimeout(() => write({ q: value || null }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  // "/" focuses search from anywhere on the page that is not already a field.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/" || e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  return (
    <div className={cn("group relative w-full sm:w-72", className)}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground transition-colors group-focus-within:text-primary"
        aria-hidden
      />
      <Input
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-10 pl-9 pr-9 text-[13px] sm:h-9"
      />
      {value ? (
        <button
          type="button"
          aria-label="Clear search"
          onClick={() => setValue("")}
          className={cn(
            "absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-subtle-foreground transition-colors hover:bg-surface-hover hover:text-foreground",
            PHONE_HIT,
            "max-sm:before:-inset-[9px]",
          )}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : (
        <kbd
          aria-hidden
          className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md border border-border/80 bg-surface-muted px-1.5 py-0.5 font-sans text-[10px] font-medium text-subtle-foreground transition-opacity group-focus-within:opacity-0"
        >
          /
        </kbd>
      )}
    </div>
  )
}

export function ViewSwitcher({ views }: { views: Array<{ key: string; label: string }> }) {
  const params = useSearchParams()
  const write = useSearchParamWriter()
  const active = params.get("view") ?? views[0].key

  return (
    <Segmented
      ariaLabel="View"
      options={views.map((v) => ({ value: v.key, label: v.label }))}
      value={active}
      onChange={(v) => write({ view: v })}
    />
  )
}

export function ListToolbar({
  newHref,
  newLabel = "New",
  onNew,
  searchPlaceholder,
  chips,
  views,
  children,
}: {
  newHref?: string
  newLabel?: string
  onNew?: () => void
  searchPlaceholder?: string
  chips?: React.ReactNode
  views?: Array<{ key: string; label: string }>
  children?: React.ReactNode
}) {
  // `icon-spin-hover`: the Plus turns a quarter on hover — "this opens something".
  // 40px tall on a phone (a thumb target), the regular 36px from `sm` up.
  const newClass = cn(
    buttonVariants({ variant: "primary", size: "md" }),
    "icon-spin-hover order-1 h-10 pl-3 sm:h-9",
  )
  return (
    /*
     * One wrapping row from `sm` up: New · search · chips · [stats] · switcher.
     * On a phone the `order-*` values re-deal the same children into rows:
     * New and the view switcher share the first (the switcher's `ml-auto`
     * pushes it to the edge), the search takes a full row of its own, and
     * chips and page-specific controls wrap below. When there are children,
     * `ml-auto` moves to them from `sm` up so the two auto margins never
     * split the free space between them.
     */
    <div className="mb-3 flex min-h-9 flex-wrap items-center gap-2">
      {newHref && (
        <Link href={newHref} className={newClass}>
          <Plus className="h-4 w-4" aria-hidden />
          {newLabel}
        </Link>
      )}
      {!newHref && onNew && (
        <button type="button" onClick={onNew} className={newClass}>
          <Plus className="h-4 w-4" aria-hidden />
          {newLabel}
        </button>
      )}

      {searchPlaceholder && (
        <SearchBox placeholder={searchPlaceholder} className="order-3 basis-full sm:order-2 sm:basis-auto" />
      )}
      {chips && <div className="order-4 flex flex-wrap items-center gap-1.5 sm:order-3">{chips}</div>}

      {children && (
        <div className="order-5 flex flex-wrap items-center gap-2 sm:order-4 sm:ml-auto">{children}</div>
      )}
      {views && (
        <div className={cn("order-2 ml-auto sm:order-5", children && "sm:ml-0")}>
          <ViewSwitcher views={views} />
        </div>
      )}
    </div>
  )
}
