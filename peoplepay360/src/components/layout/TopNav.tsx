"use client"

import { ChevronDown, Keyboard, LogOut } from "lucide-react"
import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { logoutAction } from "@/actions/auth.actions"
import { CommandPalette, PaletteTrigger, useModKey } from "@/components/layout/CommandPalette"
import { commandsFor } from "@/components/layout/commands"
import { Logo } from "@/components/layout/Logo"
import { AccentSwatches } from "@/components/theme/AccentSwatches"
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

/**
 * Roving focus for a `role="menu"` panel: arrows cycle, Home/End jump,
 * Escape and Tab close and hand focus back to the trigger.
 */
function menuKeys(e: React.KeyboardEvent<HTMLElement>, close: (refocus: boolean) => void) {
  const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
  if (items.length === 0) return
  const at = items.indexOf(document.activeElement as HTMLElement)
  const focus = (i: number) => items[(i + items.length) % items.length]?.focus()
  switch (e.key) {
    case "ArrowDown":
      e.preventDefault()
      focus(at + 1)
      break
    case "ArrowUp":
      e.preventDefault()
      focus(at - 1)
      break
    case "Home":
      e.preventDefault()
      focus(0)
      break
    case "End":
      e.preventDefault()
      focus(items.length - 1)
      break
    case "Escape":
      e.preventDefault()
      close(true)
      break
    case "Tab":
      // Refocus the trigger first so the browser's own Tab step lands on the
      // next island control instead of a panel that is about to unmount.
      close(true)
      break
  }
}

/**
 * Link text that knows when its navigation is in flight. `useLinkStatus`
 * must be called from inside the <Link>, so the label is its own component;
 * the shimmer underline is pure CSS keyed off data-pending.
 */
function NavLabel({ children }: { children: React.ReactNode }) {
  const { pending } = useLinkStatus()
  return (
    <span className="nav-label" data-pending={pending}>
      {children}
    </span>
  )
}

const navItemClass = (active: boolean) =>
  cn(
    "nav-item relative z-10 inline-flex h-8 items-center gap-1 rounded-lg px-3 text-[13px] font-medium",
    "transition-colors duration-150 ease-out-quart",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
    active ? "text-primary" : "text-muted-foreground hover:text-foreground",
  )

const menuPanelClass =
  "absolute z-50 mt-2 min-w-48 origin-top-left animate-scale-in rounded-xl border border-border/70 bg-surface-raised p-1 shadow-modal"

const menuItemClass = (active: boolean) =>
  cn(
    "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors duration-100",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60",
    active ? "bg-primary-subtle text-primary" : "text-foreground hover:bg-surface-hover",
  )

const HOVER_OPEN_MS = 90
const HOVER_CLOSE_MS = 180

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
  const triggerRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const focusFirst = useRef(false)
  const hoverTimer = useRef<number | undefined>(undefined)

  const close = useCallback(() => setOpen(false), [])
  const ref = useDismissOnOutside(close)

  // Opened from the keyboard: move focus into the panel once it exists.
  useEffect(() => {
    if (open && focusFirst.current) {
      focusFirst.current = false
      panelRef.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
    }
  }, [open])

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const closeMenu = (refocus: boolean) => {
    setOpen(false)
    if (refocus) triggerRef.current?.focus()
  }

  // Hover intent: mice glide across the island and expect menus to follow;
  // touch and keyboard keep click semantics.
  const onPointerEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setOpen(true), HOVER_OPEN_MS)
  }
  const onPointerLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return
    window.clearTimeout(hoverTimer.current)
    hoverTimer.current = window.setTimeout(() => setOpen(false), HOVER_CLOSE_MS)
  }

  return (
    <div
      ref={ref}
      className="relative"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        data-active={active}
        onClick={() => {
          window.clearTimeout(hoverTimer.current)
          setOpen((v) => !v)
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || (!open && (e.key === "Enter" || e.key === " "))) {
            e.preventDefault()
            focusFirst.current = true
            setOpen(true)
          }
        }}
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
        <div
          ref={panelRef}
          role="menu"
          aria-label={item.label}
          onKeyDown={(e) => menuKeys(e, closeMenu)}
          className={cn(menuPanelClass, "left-0")}
        >
          {item.children!.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(`${child.href}/`)
            return (
              <Link
                key={child.href}
                href={child.href}
                role="menuitem"
                aria-current={childActive ? "page" : undefined}
                onClick={() => setOpen(false)}
                className={menuItemClass(childActive)}
              >
                <NavLabel>{child.label}</NavLabel>
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
  const close = useCallback(() => setOpen(false), [])
  const ref = useDismissOnOutside(close)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const mod = useModKey()
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()

  return (
    <div ref={ref} className="relative">
      <button
        ref={triggerRef}
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
        <div
          role="menu"
          aria-label="Account"
          onKeyDown={(e) =>
            menuKeys(e, (refocus) => {
              setOpen(false)
              if (refocus) triggerRef.current?.focus()
            })
          }
          className={cn(menuPanelClass, "right-0 w-64 origin-top-right")}
        >
          <div className="flex items-center gap-3 px-3 py-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-subtle text-xs font-semibold text-primary ring-1 ring-primary/15">
              {initials}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium">{name}</span>
              <span className="mt-0.5 inline-flex rounded-md bg-surface-muted px-1.5 py-px text-[10.5px] font-medium uppercase tracking-wider text-muted-foreground ring-1 ring-inset ring-border/60">
                {roleLabel}
              </span>
            </span>
          </div>

          <div className="my-1 border-t border-border/70" />

          <div className="px-2 py-1.5">
            <p className="mb-1.5 px-1 text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
              Appearance
            </p>
            <AppearanceSegment />
            <div className="mt-2 flex items-center justify-between px-1">
              <span className="text-[11px] font-medium uppercase tracking-wider text-subtle-foreground">
                Accent
              </span>
              <AccentSwatches />
            </div>
          </div>

          <div className="my-1 border-t border-border/70" />

          <div className="flex items-center justify-between px-3 py-1.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-2">
              <Keyboard className="h-4 w-4" aria-hidden />
              Shortcuts
            </span>
            <span className="flex items-center gap-2" aria-hidden>
              <span className="flex items-center gap-0.5">
                <kbd className="kbd">{mod}</kbd>
                <kbd className="kbd">K</kbd>
              </span>
              <kbd className="kbd">/</kbd>
            </span>
          </div>

          <div className="my-1 border-t border-border/70" />

          <form action={logoutAction}>
            <button
              type="submit"
              role="menuitem"
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition-colors duration-100 hover:bg-danger-subtle hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/60"
            >
              <LogOut className="h-4 w-4 opacity-70" aria-hidden />
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
  const commands = useMemo(() => commandsFor(items), [items])

  const isActive = (item: NavItem) =>
    item.children
      ? item.children.some((c) => pathname.startsWith(c.href))
      : pathname === item.href || pathname.startsWith(`${item.href}/`)

  // The active pill is measured, not styled per item, so it can slide
  // between entries. The measurement is written straight to CSS variables:
  // no state, no re-render, and the pill moves on the compositor.
  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const measure = () => {
      const el = nav.querySelector<HTMLElement>('[data-active="true"]')
      if (!el) {
        nav.style.setProperty("--pill-o", "0")
        return
      }
      // Rects, not offsetLeft: dropdown triggers sit inside a `relative`
      // wrapper, which would make their offset 0.
      const navRect = nav.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      nav.style.setProperty("--pill-x", `${rect.left - navRect.left}px`)
      nav.style.setProperty("--pill-w", `${rect.width}px`)
      nav.style.setProperty("--pill-o", "1")
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(nav)
    return () => ro.disconnect()
  }, [pathname, items])

  return (
    <header className="nav-shell sticky top-0 z-40 px-4 pb-2 pt-3 sm:px-6">
      <div className="nav-island relative mx-auto flex h-14 max-w-[1440px] items-center gap-2 rounded-2xl border border-border/70 bg-surface/80 px-3 shadow-nav backdrop-blur-xl">
        <Logo className="mr-2 pl-1" />

        {/* No overflow here: the dropdown panels are absolutely positioned
            inside this nav and an overflow-auto container would clip them. */}
        <nav
          ref={navRef}
          aria-label="Primary"
          className="relative flex min-w-0 flex-1 items-center gap-0.5"
        >
          <span aria-hidden className="nav-pill" />
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
                aria-current={isActive(item) ? "page" : undefined}
                className={navItemClass(isActive(item))}
              >
                <NavLabel>{item.label}</NavLabel>
              </Link>
            ),
          )}
        </nav>

        <PaletteTrigger />
        <ThemeToggle />
        <div className="mx-1 h-6 w-px bg-border/80" aria-hidden />
        <UserMenu name={userName} roleLabel={roleLabel} />
      </div>

      <CommandPalette commands={commands} />
    </header>
  )
}
