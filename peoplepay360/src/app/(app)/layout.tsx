import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { TopNav } from "@/components/layout/TopNav"
import { ROLE_LABEL, rankOf, ROLE_RANK, type SessionUser } from "@/lib/auth-guard"
import { navFor } from "@/lib/nav"
import type { Role } from "@prisma/client"

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect("/login")

  const user = session.user as SessionUser
  const rank = rankOf(user.roles)
  const topRole = (Object.keys(ROLE_RANK) as Role[]).find((r) => ROLE_RANK[r] === rank)

  return (
    <div className="min-h-screen bg-background">
      <TopNav
        items={navFor(user)}
        userName={user.name}
        roleLabel={topRole ? ROLE_LABEL[topRole] : "Employee"}
      />
      <main className="mx-auto max-w-[1440px] px-6 py-5">{children}</main>
    </div>
  )
}
