"use client"

import { Search, X } from "lucide-react"
import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Input } from "@/components/ui/field"
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

export function FilterChip({ label, paramKey }: { label: string; paramKey: string }) {
  const write = useSearchParamWriter()
  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-primary-subtle px-2 py-1 text-xs font-medium text-primary">
      {label}
      <button
        type="button"
        aria-label={`Remove filter ${label}`}
        onClick={() => write({ [paramKey]: null })}
        className="rounded hover:bg-primary/10"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}

function SearchBox({ placeholder }: { placeholder: string }) {
  const params = useSearchParams()
  const write = useSearchParamWriter()
  const [value, setValue] = useState(params.get("q") ?? "")

  useEffect(() => {
    setValue(params.get("q") ?? "")
  }, [params])

  // Debounce so typing does not fire a navigation per keystroke.
  useEffect(() => {
    const current = params.get("q") ?? ""
    if (value === current) return
    const t = setTimeout(() => write({ q: value || null }), 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  return (
    <div className="relative w-72">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-subtle-foreground" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="h-8 pl-8 text-xs"
      />
    </div>
  )
}

export function ViewSwitcher({ views }: { views: Array<{ key: string; label: string }> }) {
  const params = useSearchParams()
  const write = useSearchParamWriter()
  const active = params.get("view") ?? views[0].key

  return (
    <div className="flex items-center gap-0.5 rounded-md border border-border bg-surface p-0.5">
      {views.map((v) => (
        <button
          key={v.key}
          type="button"
          onClick={() => write({ view: v.key })}
          className={cn(
            "rounded px-2.5 py-1 text-xs font-medium transition-colors",
            active === v.key
              ? "bg-primary-subtle text-primary"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {v.label}
        </button>
      ))}
    </div>
  )
}

export function ListToolbar({
  newHref,
  newLabel = "NEW",
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
  return (
    <div className="flex h-12 items-center gap-3 rounded-t-lg border border-b-0 border-border bg-surface-muted px-4">
      {newHref && (
        <Link
          href={newHref}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-fg hover:bg-primary-hover"
        >
          {newLabel}
        </Link>
      )}
      {!newHref && onNew && (
        <button
          type="button"
          onClick={onNew}
          className="inline-flex h-8 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-fg hover:bg-primary-hover"
        >
          {newLabel}
        </button>
      )}

      {searchPlaceholder && <SearchBox placeholder={searchPlaceholder} />}
      {chips && <div className="flex items-center gap-1.5">{chips}</div>}

      <div className="ml-auto flex items-center gap-2">
        {children}
        {views && <ViewSwitcher views={views} />}
      </div>
    </div>
  )
}
