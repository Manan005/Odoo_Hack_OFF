import type { Metadata } from "next"
import { cookies } from "next/headers"
import { ThemeProvider } from "@/components/theme/ThemeProvider"
import { ThemedToaster } from "@/components/theme/ThemedToaster"
import { THEME_COOKIE, type Theme } from "@/lib/theme"
import "./globals.css"

export const metadata: Metadata = {
  title: "PeoplePay360 — HR & Payroll",
  description: "Integrated HR and payroll operations platform",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // The theme is rendered server-side from a cookie, so the first paint is
  // already right and there is no inline script for React to reconcile.
  const raw = (await cookies()).get(THEME_COOKIE)?.value
  const theme: Theme = raw === "light" || raw === "dark" || raw === "system" ? raw : "system"

  return (
    // `data-scroll-behavior` lets Next disable smooth scrolling during route
    // transitions (it warns otherwise, since globals.css sets it on <html>).
    <html lang="en" data-theme={theme} data-scroll-behavior="smooth">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider initialTheme={theme}>
          {children}
          <ThemedToaster />
        </ThemeProvider>
      </body>
    </html>
  )
}
