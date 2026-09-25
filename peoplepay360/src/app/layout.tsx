import type { Metadata } from "next"
import { cookies } from "next/headers"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { ThemedToaster } from "@/components/theme/ThemedToaster"
import { DEFAULT_ACCENT, isTheme, THEME_COOKIE, type Theme } from "@/lib/theme"
import "./globals.css"

export const metadata: Metadata = {
  title: "PeoplePay360 — HR & Payroll",
  description: "Integrated HR and payroll operations platform",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme is rendered server-side from a cookie, so the first paint is
  // already right and there is no inline script for React to reconcile.
  // The accent is fixed: one hue for the whole product (lib/theme.ts), not a
  // per-visitor choice, so no cookie is consulted for it.
  const rawTheme = (await cookies()).get(THEME_COOKIE)?.value
  const theme: Theme = isTheme(rawTheme) ? rawTheme : "system"

  return (
    // `data-scroll-behavior` lets Next disable smooth scrolling during route
    // transitions (it warns otherwise, since globals.css sets it on <html>).
    <html lang="en" data-theme={theme} data-accent={DEFAULT_ACCENT} data-scroll-behavior="smooth">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider initialTheme={theme}>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
