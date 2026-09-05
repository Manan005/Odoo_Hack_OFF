import { AttendanceStatus } from "@prisma/client"
import { Clock, Pencil } from "lucide-react"
import { CheckInOutWidget } from "@/components/attendance/CheckInOutWidget"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtDateCompact, fmtTime } from "@/lib/dates"
import { formatHours } from "@/lib/money"

export const metadata = { title: "Attendance — PeoplePay360" }

type Row = {
  id: string
  checkIn: Date
  checkOut: Date | null
  workedHours: unknown
  overtime: unknown
  status: AttendanceStatus
  manuallyEdited: boolean
  employee: { firstName: string; lastName: string }
}

const columns: Column<Row>[] = [
  {
    key: "employee",
    header: "Employee",
    render: (r) => `${r.employee.firstName} ${r.employee.lastName}`,
  },
  { key: "date", header: "Date", render: (r) => fmtDateCompact(r.checkIn) },
  { key: "in", header: "Check In", render: (r) => fmtTime(r.checkIn) },
  {
    key: "out",
    header: "Check Out",
    render: (r) =>
      r.checkOut ? (
        fmtTime(r.checkOut)
      ) : (
        <span className="text-warning" title="Missing check-out">
          —
        </span>
      ),
  },
  {
    key: "hours",
    header: "Worked Hours",
    numeric: true,
    render: (r) => formatHours(String(r.workedHours)),
  },
  {
    key: "ot",
    header: "Overtime",
    numeric: true,
    render: (r) =>
      Number(r.overtime) > 0 ? (
        <span className="text-success">{formatHours(String(r.overtime))}</span>
      ) : (
        <span className="text-muted-foreground">—</span>
      ),
  },
  {
    key: "status",
    header: "Status",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5">
        <StatusBadge status={r.status} />
        {r.manuallyEdited && (
          <Pencil className="h-3 w-3 text-muted-foreground" aria-label="Manually corrected" />
        )}
      </span>
    ),
  },
]

const PAGE_SIZE = 50

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; employeeId?: string; status?: string; today?: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  const { q, employeeId, status, today } = await searchParams

  // EMPLOYEE rank sees only their own rows — narrowed in the where clause.
  const scopedEmployeeId = isHr ? employeeId : (viewer.employeeId ?? "__none__")

  const startOfToday = new Date()
  startOfToday.setHours(0, 0, 0, 0)

  const where = {
    ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
    ...(status && status in AttendanceStatus
      ? { status: status as AttendanceStatus }
      : {}),
    ...(today === "1" ? { checkIn: { gte: startOfToday } } : {}),
    ...(q
      ? {
          OR: [
            { employee: { firstName: { contains: q, mode: "insensitive" as const } } },
            { employee: { lastName: { contains: q, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  }

  const [rows, total, filterEmployee, myToday] = await Promise.all([
    db.attendance.findMany({
      where,
      select: {
        id: true,
        checkIn: true,
        checkOut: true,
        workedHours: true,
        overtime: true,
        status: true,
        manuallyEdited: true,
        employee: { select: { firstName: true, lastName: true } },
      },
      orderBy: { checkIn: "desc" },
      take: PAGE_SIZE,
    }),
    db.attendance.count({ where }),
    employeeId && isHr
      ? db.employee.findUnique({
          where: { id: employeeId },
          select: { firstName: true, lastName: true },
        })
      : null,
    viewer.employeeId
      ? db.attendance.findFirst({
          where: { employeeId: viewer.employeeId, checkIn: { gte: startOfToday } },
          orderBy: { checkIn: "desc" },
          select: { id: true, checkIn: true, checkOut: true, workedHours: true },
        })
      : null,
  ])

  return (
    <>
      <PageHeader
        title="Attendance"
        subtitle="Worked hours and overtime derive from the employee's working schedule."
      />

      {viewer.employeeId && (
        <CheckInOutWidget
          today={
            myToday
              ? { ...myToday, workedHours: String(myToday.workedHours) }
              : null
          }
        />
      )}

      <ListToolbar
        newHref="/attendance/new"
        searchPlaceholder="Search attendance…"
        chips={
          <>
            {filterEmployee && (
              <FilterChip
                paramKey="employeeId"
                label={`Employee: ${filterEmployee.firstName} ${filterEmployee.lastName}`}
              />
            )}
            {status && <FilterChip paramKey="status" label={`Status: ${status}`} />}
            {today === "1" && <FilterChip paramKey="today" label="Today" />}
          </>
        }
      />

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/attendance/${r.id}`}
        empty={
          <EmptyState
            icon={Clock}
            title="No attendance records"
            description="Check in from the panel above, or record an entry manually."
          />
        }
        footer={<RowCount shown={rows.length} total={total} />}
      />
    </>
  )
}
