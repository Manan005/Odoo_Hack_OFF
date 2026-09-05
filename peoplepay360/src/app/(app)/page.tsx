import { redirect } from "next/navigation"
import { requireAuth } from "@/lib/auth-guard"
import { landingFor } from "@/lib/nav"

export default async function HomePage() {
  const user = await requireAuth()
  redirect(landingFor(user))
}
