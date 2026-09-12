"use client"

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react"
import {
  ACCENT_COOKIE,
  DEFAULT_ACCENT,
  isAccent,
  isTheme,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type Accent,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme"

export type { Accent, ResolvedTheme, Theme }

/** Viewport point a theme change should radiate from (the toggle's centre). */
export interface ThemeOrigin {
  x: number
  y: number
}

interface ThemeContextValue {
  theme: Theme
  resolved: ResolvedTheme
  accent: Accent
  setTheme: (theme: Theme, origin?: ThemeOrigin) => void
  setAccent: (accent: Accent) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/*
 * The source of truth is the `data-theme` / `data-accent` attributes the root
 * layout renders from cookies. The client reads them back through
 * useSyncExternalStore so the server snapshot (passed in as props) and the
 * DOM always agree — no inline script, no hydration mismatch, nothing React
 * has to create.
 */

const readTheme = (): Theme => {
  const v = document.documentElement.dataset.theme
  return isTheme(v) ? v : "system"
}

const readAccent = (): Accent => {
  const v = document.documentElement.dataset.accent
  return isAccent(v) ? v : DEFAULT_ACCENT
}

const systemPrefers = (): ResolvedTheme =>
  matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"

const resolve = (theme: Theme): ResolvedTheme => (theme === "system" ? systemPrefers() : theme)

const listeners = new Set<() => void>()
const emit = () => listeners.forEach((l) => l())

function subscribe(onChange: () => void) {
  listeners.add(onChange)
  const mq = matchMedia("(prefers-color-scheme: dark)")
  mq.addEventListener("change", onChange)
  return () => {
    listeners.delete(onChange)
    mq.removeEventListener("change", onChange)
  }
}

const getResolved = (): ResolvedTheme => resolve(readTheme())

type DocumentWithViewTransition = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> }
}

/**
 * Run a document-wide colour change as a single composited View Transition.
 * With an origin the new page is revealed through a circle growing from that
 * point (see `.theme-reveal` in styles/foundation.css); without one it is the
 * default crossfade. Either way it is one snapshot and one style recalc,
 * instead of thousands of per-element colour animations on the main thread.
 */
function transition(mutate: () => void, origin?: ThemeOrigin) {
  const html = document.documentElement

  // Freeze every element's own colour transition for the swap. Otherwise the
  // "new" snapshot catches nav items, buttons and rows mid-transition and they
  // visibly finish changing after the reveal has ended.
  html.classList.add("theme-swapping")
  const release = () => {
    html.classList.remove("theme-swapping", "theme-reveal")
  }

  // Notify React only once the attribute has actually changed. The View
  // Transition callback runs after the old-state snapshot is taken, so
  // emitting synchronously from the caller would re-read the DOM before the
  // swap and leave every subscriber (the toggle's `resolved`) stale — the
  // second click would then compute the same theme and do nothing.
  const apply = () => {
    mutate()
    emit()
  }

  const doc = document as DocumentWithViewTransition
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!reduceMotion && typeof doc.startViewTransition === "function") {
    if (origin) {
      // Radius to the farthest viewport corner, so the circle always covers.
      const r = Math.hypot(
        Math.max(origin.x, window.innerWidth - origin.x),
        Math.max(origin.y, window.innerHeight - origin.y),
      )
      html.style.setProperty("--vt-x", `${origin.x}px`)
      html.style.setProperty("--vt-y", `${origin.y}px`)
      html.style.setProperty("--vt-r", `${r}px`)
      html.classList.add("theme-reveal")
    }
    doc.startViewTransition(apply).finished.finally(release)
  } else {
    apply()
    requestAnimationFrame(() => requestAnimationFrame(release))
  }
}

const writeCookie = (name: string, value: string) => {
  // The cookie is what lets the *server* render the right theme next time.
  document.cookie = `${name}=${value}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
}

export function ThemeProvider({
  initialTheme,
  initialAccent = DEFAULT_ACCENT,
  children,
}: {
  /** What the root layout rendered on <html>, read from the cookie. */
  initialTheme: Theme
  initialAccent?: Accent
  children: React.ReactNode
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initialTheme)
  const resolved = useSyncExternalStore(subscribe, getResolved, () =>
    initialTheme === "system" ? "light" : initialTheme,
  )
  const accent = useSyncExternalStore(subscribe, readAccent, () => initialAccent)

  const setTheme = useCallback((next: Theme, origin?: ThemeOrigin) => {
    if (document.documentElement.dataset.theme === next) return
    writeCookie(THEME_COOKIE, next)
    transition(() => {
      document.documentElement.dataset.theme = next
    }, origin)
  }, [])

  const setAccent = useCallback((next: Accent) => {
    if (document.documentElement.dataset.accent === next) return
    writeCookie(ACCENT_COOKIE, next)
    transition(() => {
      document.documentElement.dataset.accent = next
    })
  }, [])

  const value = useMemo(
    () => ({ theme, resolved, accent, setTheme, setAccent }),
    [theme, resolved, accent, setTheme, setAccent],
  )

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}
