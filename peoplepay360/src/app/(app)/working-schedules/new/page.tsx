import { Role } from "@prisma/client"
import { ScheduleForm } from "@/components/schedules/WeeklyPatternGrid"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import { emptySchedule } from "@/lib/form-defaults"

export const metadata = { title: "New Working Schedule — PeoplePay360" }

export default async function NewSchedulePage() {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Working schedules are managed by HR." />

  return (
    <>
      <PageHeader
        title="New Working Schedule"
        subtitle="Define the weekly pattern — days, hours and breaks come from these lines."
      />
      <ScheduleForm initial={emptySchedule} />
    </>
  )
}
