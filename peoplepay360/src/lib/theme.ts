/**
 * Theme vocabulary shared by the server (root layout reads the cookie) and
 * the client (provider + toggles). Deliberately not a "use client" module:
 * a function exported from one becomes a client reference on the server and
 * cannot be called there.
 */
export type Theme = "light" | "dark" | "system"
export type ResolvedTheme = "light" | "dark"

export const THEME_COOKIE = "pp360-theme"
export const THEME_COOKIE_MAX_AGE = 60 * 60 * 24 * 365

export const isTheme = (v: unknown): v is Theme => v === "light" || v === "dark" || v === "system"
