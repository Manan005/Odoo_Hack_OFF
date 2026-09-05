"use client"

import { ChevronDown, LogOut } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { logoutAction } from "@/actions/auth.actions"
import { Logo } from "@/components/layout/Logo"
import { AppearanceSegment, ThemeToggle } from "@/components/theme/ThemeToggle"
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

const navItemClass = (active: boolean) =>
  cn(
    "relative z-10 inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[13px] font-medium",
    "transition-colors duration-150 ease-out-quart",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  )

const menuPanelClass =
  "absolute z-50 mt-2 min-w-48 origin-top-left animate-scale-in rounded-xl border border-border/70 bg-surface-raised p-1 shadow-modal"

function NavDropdown({
  item,
  active,
  pathname,
}: {
  item: NavItem
  active: boolean
  pathname: string
}) {
  const [open, setOpen] = useState(false)
  const ref = useDismissOnOutside(() => setOpen(false))

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        data-active={active}
        onClick={() => setOpen((v) => !v)}
        className={navItemClass(active)}
      >
        {item.label}
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200 ease-out-quart",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div role="menu" className={cn(menuPanelClass, "left-0")}>
          {item.children!.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
            return (
              <Link
                key={child.href}
                href={child.href}
                role="menuitem"
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors duration-100",
                  childActive
                    ? "bg-primary-subtle text-primary"
                    : "text-foreground hover:bg-surface-hover",
                )}
              >
                {child.label}
                {childActive && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-hidden />}
              </Link>
            )
          })}
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
        className={cn(
          "flex h-9 items-center gap-2 rounded-lg pl-1 pr-2 transition-colors duration-150",
          "hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
          open && "bg-surface-hover",
        )}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-[8px] bg-primary-subtle text-[11px] font-semibold text-primary ring-1 ring-primary/15">
          {initials}
        </span>
        <span className="hidden text-left sm:block">
          <span className="block text-xs font-medium leading-tight">{name}</span>
          <span className="block text-[11px] leading-tight text-muted-foreground">{roleLabel}</span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground transition-transform duration-200",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open && (
        <div role="menu" className={cn(menuPanelClass, "right-0 w-60 origin-top-right")}>
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{name}</p>
            <p className="text-xs text-muted-foreground">{roleLabel}</p>
          </div>
          <div className="my-1 border-t border-border/70" />
          <div className="px-2 py-1.5">
            <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
              Appearance
            </p>
            <AppearanceSegment />
          </div>
          <div className="my-1 border-t border-border/70" />
          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors duration-100 hover:bg-surface-hover"
            >
              <LogOut className="h-4 w-4 text-muted-foreground" aria-hidden />
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
  const navRef = useRef<HTMLElement>(null)
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null)

  const isActive = (item: NavItem) =>
    item.children
      ? item.children.some((c) => pathname.startsWith(c.href))
      : pathname === item.href || pathname.startsWith(`${item.href}/`)

  // The active pill is measured, not styled per item, so it can slide
  // between entries as the route changes.
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[data-active="true"]')
      if (!el) {
        setPill(null)
        return
      }
      // Rects, not offsetLeft: dropdown triggers sit inside a `relative`
      // wrapper, which would make their offset 0.
      const navRect = nav.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      setPill({ left: rect.left - navRect.left, width: rect.width })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [pathname, items])

  return (
    <header className="sticky top-0 z-40 px-4 pb-2 pt-3 sm:px-6">
      <div className="mx-auto flex h-14 max-w-[1440px] items-center gap-2 rounded-2xl border border-border/70 bg-surface/80 px-3 shadow-nav backdrop-blur-xl">
        <Logo className="mr-2 pl-1" />

        {/* No overflow here: the dropdown panels are absolutely positioned
            inside this nav and an overflow-auto container would clip them. */}
        <nav
          ref={navRef}
          aria-label="Primary"
          className="relative flex min-w-0 flex-1 items-center gap-0.5"
        >
          <span
            aria-hidden
            className="absolute top-1/2 h-8 -translate-y-1/2 rounded-lg bg-primary-subtle transition-[left,width,opacity] duration-300 ease-out-quart"
            style={{ left: pill?.left ?? 0, width: pill?.width ?? 0, opacity: pill ? 1 : 0 }}
          />
          {items.map((item) =>
            item.children ? (
              <NavDropdown
                key={item.label}
                item={item}
                active={isActive(item)}
                pathname={pathname}
              />
            ) : (
              <Link
                key={item.href}
                href={item.href}
                data-active={isActive(item)}
                className={navItemClass(isActive(item))}
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <ThemeToggle />
        <div className="mx-1 h-6 w-px bg-border/80" aria-hidden />
        <UserMenu name={userName} roleLabel={roleLabel} />
      </div>
    </header>
  )
}
