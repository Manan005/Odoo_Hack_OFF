import { ArrowLeft, ShieldAlert } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export function Forbidden({
  message = "Your role does not grant access to this area. If you believe this is a mistake, contact your administrator.",
}: {
  message?: string
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-24 text-center">
      <ShieldAlert className="h-10 w-10 text-danger" />
      <h1 className="mt-4 text-xl font-semibold">403 — Access denied</h1>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>
      <Link href="/" className="mt-5">
        <Button variant="outline">
          <ArrowLeft className="h-4 w-4" />
          Back to workspace
        </Button>
      </Link>
    </div>
  )
}
