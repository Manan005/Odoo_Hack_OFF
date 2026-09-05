import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { TopNav } from "@/components/layout/TopNav"
import { PageTransition } from "@/components/motion/PageTransition"
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
    <div className="relative min-h-dvh">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <div aria-hidden className="ambient-glow pointer-events-none absolute inset-x-0 top-0 h-[420px]" />

      <TopNav
        items={navFor(user)}
        userName={user.name}
        roleLabel={topRole ? ROLE_LABEL[topRole] : "Employee"}
      />

      <main id="main" className="relative mx-auto max-w-[1440px] px-4 pb-16 pt-4 sm:px-6">
        <PageTransition>{children}</PageTransition>
      </main>
    </div>
  )
}
