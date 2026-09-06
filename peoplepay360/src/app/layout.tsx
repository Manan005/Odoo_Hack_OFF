import type { Metadata } from "next"
import { cookies } from "next/headers"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { ThemedToaster } from "@/components/theme/ThemedToaster"
import {
  ACCENT_COOKIE,
  DEFAULT_ACCENT,
  isAccent,
  isTheme,
  THEME_COOKIE,
  type Accent,
  type Theme,
} from "@/lib/theme"
import "./globals.css"

export const metadata: Metadata = {
  title: "PeoplePay360 — HR & Payroll",
  description: "Integrated HR and payroll operations platform",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Theme and accent are rendered server-side from cookies, so the first
  // paint is already right and there is no inline script for React to
  // reconcile.
  const jar = await cookies()
  const rawTheme = jar.get(THEME_COOKIE)?.value
  const theme: Theme = isTheme(rawTheme) ? rawTheme : "system"
  const rawAccent = jar.get(ACCENT_COOKIE)?.value
  const accent: Accent = isAccent(rawAccent) ? rawAccent : DEFAULT_ACCENT

  return (
    // `data-scroll-behavior` lets Next disable smooth scrolling during route
    // transitions (it warns otherwise, since globals.css sets it on <html>).
    <html lang="en" data-theme={theme} data-accent={accent} data-scroll-behavior="smooth">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider initialTheme={theme} initialAccent={accent}>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
