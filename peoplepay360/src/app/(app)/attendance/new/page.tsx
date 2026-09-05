import {
  AttendanceForm,
  emptyAttendance,
} from "@/components/attendance/AttendanceForm"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "Record Attendance — PeoplePay360" }

export default async function NewAttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  const { employeeId } = await searchParams

  // An employee may log their own time; only HR may log someone else's.
  const employees = isHr
    ? await db.employee
        .findMany({
          where: { active: true },
          select: { id: true, firstName: true, lastName: true },
          orderBy: { firstName: "asc" },
        })
        .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` })))
    : await db.employee
        .findMany({
          where: { id: viewer.employeeId ?? "__none__" },
          select: { id: true, firstName: true, lastName: true },
        })
        .then((rows) => rows.map((r) => ({ id: r.id, name: `${r.firstName} ${r.lastName}` })))

  const defaultEmployeeId = isHr ? (employeeId ?? "") : (viewer.employeeId ?? "")

  const lines = defaultEmployeeId
    ? ((
        await db.employee.findUnique({
          where: { id: defaultEmployeeId },
          select: { workingSchedule: { select: { lines: true } } },
        })
      )?.workingSchedule?.lines ?? [])
    : []

  return (
    <>
      <PageHeader
        title="Record Attendance"
        subtitle="Worked hours and overtime are computed from the schedule — they cannot be typed in."
      />
      <AttendanceForm
        initial={{ ...emptyAttendance, employeeId: defaultEmployeeId }}
        employees={employees}
        scheduleLines={lines.map((l) => ({
          day: l.day,
          startTime: l.startTime,
          endTime: l.endTime,
          breakHours: Number(l.breakHours),
          hours: Number(l.hours),
        }))}
        canEdit
      />
    </>
  )
}
