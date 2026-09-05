"use client"

import { ArrowLeft, ShieldAlert, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
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
  const denied =
    [...DENIED].some((code) => error.message.includes(code)) || error.name === "AuthError"

  return (
    <StatusPage
      code={denied ? "403" : undefined}
      icon={denied ? ShieldAlert : TriangleAlert}
      tone={denied ? "danger" : "warning"}
      title={denied ? "Access denied" : "Something went wrong"}
      message={
        denied
          ? "Your role does not grant access to this area. If you believe this is a mistake, contact your administrator."
          : error.message
      }
      actions={
        <>
          <Link href="/">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back to workspace
            </Button>
          </Link>
          {!denied && (
            <Button variant="primary" onClick={reset}>
              Try again
            </Button>
          )}
        </>
      }
    />
  )
}
