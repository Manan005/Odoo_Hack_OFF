"use client"

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react"
import {
  isTheme,
  THEME_COOKIE,
  THEME_COOKIE_MAX_AGE,
  type ResolvedTheme,
  type Theme,
} from "@/lib/theme"

export type { ResolvedTheme, Theme }

interface ThemeContextValue {
  theme: Theme
  resolved: ResolvedTheme
  setTheme: (theme: Theme) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

/*
 * The source of truth is the `data-theme` attribute the root layout renders
 * from the cookie. The client reads it back through useSyncExternalStore so
 * the server snapshot (passed in as a prop) and the DOM always agree — no
 * inline script, no hydration mismatch, nothing React has to create.
 */

const readTheme = (): Theme => {
  const v = document.documentElement.dataset.theme
  return isTheme(v) ? v : "system"
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

function applyToDocument(next: Theme) {
  const html = document.documentElement
  if (html.dataset.theme === next) return

  // Freeze every element's own colour transition for the swap. Otherwise the
  // "new" snapshot catches nav items, buttons and rows mid-transition and they
  // visibly finish changing after the crossfade has ended.
  html.classList.add("theme-swapping")
  const swap = () => {
    html.dataset.theme = next
  }
  const release = () => html.classList.remove("theme-swapping")

  // One snapshot, one style recalc, one composited crossfade — instead of
  // thousands of per-element colour animations on the main thread.
  const doc = document as DocumentWithViewTransition
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches
  if (!reduceMotion && typeof doc.startViewTransition === "function") {
    doc.startViewTransition(swap).finished.finally(release)
  } else {
    swap()
    requestAnimationFrame(() => requestAnimationFrame(release))
  }
}

export function ThemeProvider({
  initialTheme,
  children,
}: {
  /** What the root layout rendered on <html>, read from the cookie. */
  initialTheme: Theme
  children: React.ReactNode
}) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => initialTheme)
  const resolved = useSyncExternalStore(subscribe, getResolved, () =>
    initialTheme === "system" ? "light" : initialTheme,
  )

  const setTheme = useCallback((next: Theme) => {
    // The cookie is what lets the *server* render the right theme next time.
    document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${THEME_COOKIE_MAX_AGE}; samesite=lax`
    applyToDocument(next)
    emit()
  }, [])

  const value = useMemo(() => ({ theme, resolved, setTheme }), [theme, resolved, setTheme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error("useTheme must be used inside <ThemeProvider>")
  return ctx
}
