/**
 * Theme vocabulary shared by the server (root layout reads the cookies) and
 * the client (provider + toggles). Deliberately not a "use client" module:
 * a function exported from one becomes a client reference on the server and
 * cannot be called there.
 */
export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_COOKIE = "pp360-theme"
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark" || v === "system"

/**
 * Accent hues. Every primary token is an oklch colour whose hue is
 * `--accent-h`, driven by the `data-accent` attribute the root layout renders.
 * The product ships ONE accent (DEFAULT_ACCENT); the list documents the hues
 * the token system was tuned against and keeps the door open, but no picker
 * exposes them and no cookie is read.
 */
export type Accent = "indigo" | "ocean" | "teal" | "emerald" | "rose" | "ember"

export const ACCENTS: ReadonlyArray<{ id: Accent; label: string; hue: number }> = [
  { id: "ocean", label: "Ocean", hue: 235 },
  { id: "indigo", label: "Indigo", hue: 270 },
  { id: "teal", label: "Teal", hue: 195 },
  { id: "emerald", label: "Emerald", hue: 155 },
  { id: "rose", label: "Rose", hue: 355 },
  { id: "ember", label: "Ember", hue: 40 },
]

/**
 * Ocean: the hue credible payroll and finance products ship (the rendered
 * button sits with Workday, PayPal and SAP), where indigo sits with the
 * template and dev-tool cluster a reviewer reads as "default dashboard".
 * Chosen from a four-lens panel over real screenshots; see docs/ui-wow.md §2.2.
 */
export const DEFAULT_ACCENT: Accent = "ocean"
