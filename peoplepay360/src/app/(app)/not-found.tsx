import { Compass, LayoutGrid } from "lucide-react"
import Link from "next/link"
import { BackButton, SearchButton } from "@/components/layout/StatusActions"
import { Suggestions } from "@/components/layout/Suggestions"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"
import { pageUser } from "@/lib/auth-guard"
import { commandsFor, navFor } from "@/lib/nav"

/**
 * Rendered for `notFound()` inside signed-in pages — a record that does not
 * exist or is out of the caller's scope. The island is mounted around it, so
 * the palette shortcut works here.
 */
export default async function NotFound() {
  const user = await pageUser()
  const commands = user ? commandsFor(navFor(user)) : []

  return (
    <StatusPage
      code="404"
      icon={Compass}
      tone="neutral"
      title="Page not found"
      message="The record may have been removed, or the link is out of date."
      actions={
        <>
          <BackButton />
          <Link href="/">
            <Button variant="primary">
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Open workspace
            </Button>
          </Link>
          <SearchButton />
        </>
      }
      footer={<Suggestions commands={commands} />}
    />
  )
}
