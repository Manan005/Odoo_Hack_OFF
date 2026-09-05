import { Role } from "@prisma/client"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { UserForm } from "@/components/users/UserForm"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "Edit User — PeoplePay360" }

export default async function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const actor = await pageAllows(Role.ADMIN)
  if (!actor) return <Forbidden message="User management is restricted to administrators." />

  const { id } = await params
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      roles: true,
      active: true,
      employee: { select: { firstName: true, lastName: true } },
    },
  })
  if (!user) notFound()

  const employeeName = user.employee
    ? `${user.employee.firstName} ${user.employee.lastName}`
    : "— not linked"

  return (
    <>
      <PageHeader title={employeeName} subtitle={user.email} />
      <UserForm
        employees={[]}
        isSelf={user.id === actor.id}
        user={{
          id: user.id,
          email: user.email,
          roles: user.roles,
          active: user.active,
          employeeName,
        }}
      />
    </>
  )
}
