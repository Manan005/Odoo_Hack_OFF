import { notFound } from "next/navigation"
import { AttendanceForm } from "@/components/attendance/AttendanceForm"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtDate } from "@/lib/dates"

/** datetime-local wants `YYYY-MM-DDTHH:mm` in local time. */
const toLocalInput = (d: Date | null) => {
  if (!d) return ""
  const pad = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours(),
  )}:${pad(d.getMinutes())}`
}

export default async function AttendanceDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const { id } = await params
  const record = await db.attendance.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          department: { select: { name: true } },
          manager: { select: { firstName: true, lastName: true } },
          workingSchedule: { select: { lines: true } },
        },
      },
    },
  })
  if (!record) notFound()

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  if (!isHr && record.employeeId !== viewer.employeeId) {
    return <Forbidden message="You can only view your own attendance." />
  }

  const editor = record.editedById
    ? await db.user.findUnique({
        where: { id: record.editedById },
        select: { email: true, employee: { select: { firstName: true, lastName: true } } },
      })
    : null

  const employeeName = `${record.employee.firstName} ${record.employee.lastName}`

  return (
    <>
      <FormHeader
        breadcrumb="Attendance"
        backHref="/attendance"
        title={`${employeeName} · ${fmtDate(record.checkIn)}`}
        subtitle={
          [
            record.employee.department?.name,
            record.employee.manager
              ? `Manager: ${record.employee.manager.firstName} ${record.employee.manager.lastName}`
              : null,
          ]
            .filter(Boolean)
            .join(" • ") || undefined
        }
        badge={<StatusBadge status={record.status} />}
      />

      <AttendanceForm
        initial={{
          id: record.id,
          employeeId: record.employeeId,
          checkIn: toLocalInput(record.checkIn),
          checkOut: toLocalInput(record.checkOut),
          status: record.status,
          notes: record.notes ?? "",
        }}
        employees={[{ id: record.employee.id, name: employeeName }]}
        scheduleLines={(record.employee.workingSchedule?.lines ?? []).map((l) => ({
          day: l.day,
          startTime: l.startTime,
          endTime: l.endTime,
          breakHours: Number(l.breakHours),
          hours: Number(l.hours),
        }))}
        canEdit={isHr}
        audit={{
          editedAt: record.editedAt,
          editedBy: editor
            ? editor.employee
              ? `${editor.employee.firstName} ${editor.employee.lastName}`
              : editor.email
            : null,
        }}
      />
    </>
  )
}
