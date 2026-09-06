"use client"

import { ArrowLeft, Search } from "lucide-react"
import { useRouter } from "next/navigation"
import { requestPalette, useModKey } from "@/components/layout/CommandPalette"
import { Button } from "@/components/ui/button"

/**
 * Client leaves for the status pages. StatusPage itself stays a Server
 * Component; only the two buttons that need the browser live here.
 */

/** history.back() when there is somewhere to go back to, else the workspace. */
export function BackButton() {
  const router = useRouter()
  return (
    <Button
      variant="outline"
      onClick={() => {
        if (window.history.length > 1) router.back()
        else router.push("/")
      }}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      Go back
    </Button>
  )
}

/** Opens the command palette — only meaningful where the island is mounted. */
export function SearchButton() {
  const mod = useModKey()
  return (
    <Button variant="ghost" onClick={requestPalette}>
      <Search className="h-4 w-4" aria-hidden />
      Search
      <span className="ml-1 hidden items-center gap-0.5 sm:inline-flex" aria-hidden>
        <kbd className="kbd">{mod}</kbd>
        <kbd className="kbd">K</kbd>
      </span>
    </Button>
  )
}
