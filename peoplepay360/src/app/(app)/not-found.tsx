import { ArrowLeft, Compass } from "lucide-react"
import Link from "next/link"
import { StatusPage } from "@/components/shared/StatusPage"
import { Button } from "@/components/ui/button"

export default function NotFound() {
  return (
    <StatusPage
      code="404"
      icon={Compass}
      tone="neutral"
      title="Page not found"
      message="The record may have been removed, or the link is out of date."
      actions={
        <Link href="/">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back to workspace
          </Button>
        </Link>
      }
    />
  )
}
