import { Compass, LayoutGrid } from "lucide-react"
import Link from "next/link"
import { Logo } from "@/components/layout/Logo"
import { BackButton } from "@/components/layout/StatusActions"
import { Suggestions } from "@/components/layout/Suggestions"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"
import { pageUser } from "@/lib/auth-guard"
import { commandsFor, navFor } from "@/lib/nav"

/**
 * Root 404 — reached for URLs that match no route at all, so there is no
 * authenticated layout (and no island or palette) around it. Signed-in
 * visitors still get their own destinations suggested. `(app)/not-found.tsx`
 * covers `notFound()` calls inside signed-in pages.
 */
export default async function RootNotFound() {
  const user = await pageUser()
  const commands = user ? commandsFor(navFor(user)) : []

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
            <>
              <BackButton />
              <Link href="/">
                <Button variant="primary">
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  Open workspace
                </Button>
              </Link>
            </>
          }
          footer={<Suggestions commands={commands} />}
        />
      </div>
    </main>
  )
}
