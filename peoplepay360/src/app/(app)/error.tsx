"use client"

import { ArrowLeft, ShieldAlert, TriangleAlert } from "lucide-react"
import Link from "next/link"
import { useEffect } from "react"
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
  const denied = [...DENIED].some((code) => error.message.includes(code)) ||
    error.name === "AuthError"

  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      {denied ? (
        <ShieldAlert className="h-10 w-10 text-danger" />
      ) : (
        <TriangleAlert className="h-10 w-10 text-warning" />
      )}

      <h1 className="mt-4 text-xl font-semibold">
        {denied ? "403 — Access denied" : "Something went wrong"}
      </h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">
        {denied
          ? "Your role does not grant access to this area. If you believe this is a mistake, contact your administrator."
          : error.message}
      </p>

      <div className="mt-5 flex items-center gap-2">
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" />
            Back to workspace
          </Button>
        </Link>
        {!denied && (
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
        )}
      </div>
    </div>
  )
}
