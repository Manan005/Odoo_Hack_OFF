"use client"

import { Banknote, ChevronDown, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"
import { logoutAction } from "@/actions/auth.actions"
import type { NavItem } from "@/lib/nav"
import { cn } from "@/lib/utils"

function useDismissOnOutside(onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("mousedown", onPointer)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onPointer)
      document.removeEventListener("keydown", onKey)
    }
  }, [onClose])
  return ref
}

function NavDropdown({ item, active }: { item: NavItem; active: boolean }) {
  const [open, setOpen] = useState(false)
  const ref = useDismissOnOutside(() => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          active
            ? "bg-primary-subtle text-primary"
            : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
        )}
      >
        {item.label}
        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 z-50 mt-1 min-w-48 rounded-md border border-border bg-surface py-1 shadow-raise"
        >
          {item.children!.map((child) => (
            <Link
              key={child.href}
              href={child.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-foreground hover:bg-surface-hover"
            >
              {child.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function UserMenu({ name, roleLabel }: { name: string; roleLabel: string }) {
  const [open, setOpen] = useState(false)
  const ref = useDismissOnOutside(() => setOpen(false))
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-subtle text-xs font-semibold text-primary">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium leading-tight">{name}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">
            {roleLabel}
          </span>
        </span>
        <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground", open && "rotate-180")} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-44 rounded-md border border-border bg-surface py-1 shadow-raise"
        >
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground hover:bg-surface-hover"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

export function TopNav({
  items,
  userName,
  roleLabel,
}: {
  items: NavItem[]
  userName: string
  roleLabel: string
}) {
  const pathname = usePathname()

  const isActive = (item: NavItem) =>
    item.children
      ? item.children.some((c) => pathname.startsWith(c.href))
      : pathname === item.href || pathname.startsWith(`${item.href}/`)

  return (
    <header className="sticky top-0 z-40 h-14 border-b border-border bg-surface">
      <div className="mx-auto flex h-full max-w-[1440px] items-center gap-1 px-6">
        <Link href="/" className="mr-4 flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-fg">
            <Banknote className="h-4 w-4" />
          </span>
          <span className="text-sm font-semibold tracking-tight">HR</span>
        </Link>

        <nav className="flex flex-1 items-center gap-1">
          {items.map((item) =>
            item.children ? (
              <NavDropdown key={item.label} item={item} active={isActive(item)} />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  isActive(item)
                    ? "bg-primary-subtle text-primary"
                    : "text-muted-foreground hover:bg-surface-hover hover:text-foreground",
                )}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <UserMenu name={userName} roleLabel={roleLabel} />
      </div>
    </header>
  )
}
