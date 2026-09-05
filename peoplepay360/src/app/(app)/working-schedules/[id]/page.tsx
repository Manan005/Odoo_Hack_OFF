import { Role } from "@prisma/client"
import { notFound } from "next/navigation"
import { ScheduleForm } from "@/components/schedules/WeeklyPatternGrid"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { SmartButtonBar } from "@/components/shared/SmartButtonBar"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { formatWeeklyHours, sortLines } from "@/lib/schedule/hours"
import { FileText, Users } from "lucide-react"

export default async function ScheduleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Working schedules are managed by HR." />

  const { id } = await params
  const schedule = await db.workingSchedule.findUnique({
    where: { id },
    include: {
      lines: true,
      _count: { select: { employees: true, contracts: true } },
    },
  })
  if (!schedule) notFound()

  return (
    <>
      <FormHeader
        breadcrumb="Working Schedules"
        backHref="/working-schedules"
        title={schedule.name}
        subtitle={`${schedule.daysPerWeek} days / ${formatWeeklyHours(
          Number(schedule.hoursPerWeek),
        )} per week`}
        badge={<ActiveBadge active={schedule.active} />}
        smartButtons={
          <SmartButtonBar
            buttons={[
              {
                label: "Employees",
                count: schedule._count.employees,
                href: `/employees?scheduleId=${schedule.id}`,
                icon: Users,
              },
              {
                label: "Contracts",
                count: schedule._count.contracts,
                href: `/contracts?scheduleId=${schedule.id}`,
                icon: FileText,
              },
            ]}
          />
        }
      />

      <ScheduleForm
        initial={{
          id: schedule.id,
          name: schedule.name,
          calendarType: schedule.calendarType,
          timezone: schedule.timezone,
          active: schedule.active,
          lines: sortLines(schedule.lines).map((l) => ({
            day: l.day,
            startTime: l.startTime,
            endTime: l.endTime,
            breakHours: Number(l.breakHours),
          })),
        }}
      />
    </>
  )
}
