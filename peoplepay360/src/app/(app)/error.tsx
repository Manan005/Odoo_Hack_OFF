"use client"

import { LayoutGrid, RotateCcw, ShieldAlert, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
import { BackButton, SearchButton } from "@/components/layout/StatusActions"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"

const DENIED = new Set(["FORBIDDEN", "UNAUTHENTICATED", "SELF_ROLE_CHANGE", "ADMIN_GRANT_DENIED"])

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[app error]", error)
  }, [error])

  // Guard failures carry their code in the message prefix from AuthError.
  // In production the message is redacted to the digest, so the name check
  // is the one that still works there.
  const denied =
    error.name === "AuthError" || [...DENIED].some((code) => error.message.includes(code))

  return (
    <StatusPage
      code={denied ? "403" : "500"}
      icon={denied ? ShieldAlert : TriangleAlert}
      tone={denied ? "danger" : "warning"}
      title={denied ? "Access denied" : "Something went wrong"}
      message={
        denied
          ? "Your role does not grant access to this area. If you believe this is a mistake, contact your administrator."
          : error.message || "The page hit an error while loading. Trying again usually clears it."
      }
      actions={
        <>
          <BackButton />
          <Link href="/">
            <Button variant={denied ? "primary" : "outline"}>
              <LayoutGrid className="h-4 w-4" aria-hidden />
              Open workspace
            </Button>
          </Link>
          {!denied && (
            <Button variant="primary" onClick={reset}>
              <RotateCcw className="h-4 w-4" aria-hidden />
              Try again
            </Button>
          )}
          <SearchButton />
        </>
      }
      footer={
        error.digest ? (
          <p className="text-center text-[11px] text-subtle-foreground">
            Ref
            <span className="mx-1.5 text-border-strong" aria-hidden>
              ·
            </span>
            <code className="rounded-md bg-surface-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground ring-1 ring-inset ring-border/60">
              {error.digest}
            </code>
          </p>
        ) : undefined
      }
    />
  )
}
