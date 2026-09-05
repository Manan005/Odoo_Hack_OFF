import { ArrowLeft, Compass } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/layout/Logo"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"

/**
 * Root 404 — reached for URLs that match no route at all, so there is no
 * authenticated layout (and no nav) around it. `(app)/not-found.tsx` covers
 * `notFound()` calls inside signed-in pages.
 */
export default function RootNotFound() {
  return (
    <main className="relative flex min-h-dvh flex-col">
      <div aria-hidden className="ambient-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
      <header className="relative px-6 pt-5">
        <Logo />
      </header>
      <div className="relative flex flex-1 items-center justify-center">
        <StatusPage
          code="404"
          icon={Compass}
          tone="neutral"
          title="Page not found"
          message="That address does not match anything in PeoplePay360. The link may be out of date."
          actions={
            <Link href="/">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4" aria-hidden />
                Back to workspace
              </Button>
            </Link>
          }
        />
      </div>
    </main>
  )
}
