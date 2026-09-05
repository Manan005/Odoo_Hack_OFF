import { Role } from "@prisma/client"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { TypeForm } from "@/components/timeoff/TypeForm"
import { pageAllows } from "@/lib/auth-guard"
import { emptyType } from "@/lib/form-defaults"

export const metadata = { title: "New Time Off Type — PeoplePay360" }

export default async function NewTimeOffTypePage() {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Time off types are managed by HR." />

  return (
    <>
      <PageHeader
        title="New Time Off Type"
        subtitle="Defines how a leave type behaves, not an individual employee's leave."
      />
      <TypeForm initial={emptyType} />
    </>
  )
}
