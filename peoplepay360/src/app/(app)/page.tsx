import { redirect } from "next/navigation"
import { pageUser } from "@/lib/auth-guard"
import { landingFor } from "@/lib/nav"

export default async function HomePage() {
  const user = await pageUser()
  if (!user) {
    redirect("/login")
  }
  redirect(landingFor(user))
}

