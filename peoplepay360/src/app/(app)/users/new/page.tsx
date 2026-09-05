import { Role } from "@prisma/client"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { UserForm } from "@/components/users/UserForm"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "New User — PeoplePay360" }

export default async function NewUserPage() {
  const actor = await pageAllows(Role.ADMIN)
  if (!actor) return <Forbidden message="User management is restricted to administrators." />

  const employees = await db.employee.findMany({
    where: { active: true },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      workEmail: true,
      user: { select: { id: true } },
    },
    orderBy: [{ firstName: "asc" }],
  })

  return (
    <>
      <PageHeader
        title="Create User"
        subtitle="Link a login to an employee record and assign one or more roles."
      />
      <UserForm
        employees={employees.map((e) => ({
          id: e.id,
          name: `${e.firstName} ${e.lastName}`,
          workEmail: e.workEmail,
          hasUser: Boolean(e.user),
        }))}
      />
    </>
  )
}
