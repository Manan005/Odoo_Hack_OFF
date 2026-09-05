"use client"

import { usePathname } from "next/navigation"

/**
 * Re-keys on the pathname so each route change plays the page entrance.
 * Search-param changes (filters, paging) keep the key and therefore do not
 * re-animate the whole page — only the rows that changed.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  )
}
