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
 * `--accent-h`, so switching the accent is one attribute on <html> and every
 * button, ring, chart-1 series and glow follows. Lightness and chroma are
 * fixed per mode so contrast against white text holds for every hue.
 */
export type Accent = "indigo" | "ocean" | "teal" | "emerald" | "rose" | "ember"

export const ACCENTS: ReadonlyArray<{ id: Accent; label: string; hue: number }> = [
  { id: "indigo", label: "Indigo", hue: 270 },
  { id: "ocean", label: "Ocean", hue: 235 },
  { id: "teal", label: "Teal", hue: 195 },
  { id: "emerald", label: "Emerald", hue: 155 },
  { id: "rose", label: "Rose", hue: 355 },
  { id: "ember", label: "Ember", hue: 40 },
]

export const DEFAULT_ACCENT: Accent = "indigo"
export const ACCENT_COOKIE = "pp360-accent"

export const isAccent = (v: unknown): v is Accent => ACCENTS.some((a) => a.id === v)
