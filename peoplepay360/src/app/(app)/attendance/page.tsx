import { AttendanceStatus } from "@prisma/client"
import { Clock, Pencil } from "lucide-react"
import Link from "next/link"
import { CheckInOutWidget } from "@/components/attendance/CheckInOutWidget"
import { Column, DataTable } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { Pagination } from "@/components/shared/Pagination"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { ATTENDANCE_STATUS_LABEL } from "@/lib/attendance/compute"
import { db } from "@/lib/db"
import { fmtDateCompact, fmtTime } from "@/lib/dates"
import { formatHours } from "@/lib/money"
import { pageInfo, pageSlice, parsePage } from "@/lib/paging"
import { cn } from "@/lib/utils"

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
  { key: "in", header: "Check In", className: "tabular", render: (r) => fmtTime(r.checkIn) },
  {
    key: "out",
    header: "Check Out",
    className: "tabular",
    render: (r) =>
      r.checkOut ? (
        fmtTime(r.checkOut)
      ) : (
        <span
          className="text-xs font-medium text-warning"
          title="Missing check-out — flagged, not guessed"
        >
          missing
        </span>
      ),
  },
  {
    key: "hours",
    header: "Worked Hours",
    numeric: true,
    render: (r) => <span className="font-medium">{formatHours(String(r.workedHours))}</span>,
  },
  {
    key: "ot",
    header: "Overtime",
    numeric: true,
    render: (r) =>
      Number(r.overtime) > 0 ? (
        <span className="font-medium text-success">+{formatHours(String(r.overtime))}</span>
      ) : (
        <span className="text-subtle-foreground">—</span>
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

/*
 * Exception filters live in the URL (rules.md §2.4): each is a plain link that
 * toggles one param and keeps the rest. Deliberately no counts — the page does
 * not fetch per-status totals, and an invented number is worse than none.
 */
const EXCEPTIONS: AttendanceStatus[] = [
  AttendanceStatus.LATE,
  AttendanceStatus.HALF_DAY,
  AttendanceStatus.ABSENT,
]

function QuickFilter({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-pressed={active}
      className={cn(
        "inline-flex h-8 items-center rounded-lg px-2.5 text-xs font-medium ring-1 ring-inset",
        "transition-[background-color,color,box-shadow,transform] duration-150 ease-out-quart active:scale-95",
        active
          ? "bg-primary text-primary-fg ring-primary shadow-primary"
          : "bg-surface text-muted-foreground ring-border/80 hover:bg-surface-hover hover:text-foreground",
      )}
    >
      {label}
    </Link>
  )
}

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    employeeId?: string
    status?: string
    today?: string
    page?: string
  }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  const { q, employeeId, status, today, page } = await searchParams

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

  // The count comes first so an out-of-range `?page=` can be clamped to the
  // last real page rather than rendering an empty table, which reads as
  // "no data" when it actually means "no such page".
  const total = await db.attendance.count({ where })
  const info = pageInfo(parsePage(page), PAGE_SIZE, total)

  const [rows, filterEmployee, myToday] = await Promise.all([
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
      // A stable tiebreaker — several rows share a checkIn timestamp, and
      // without it Postgres may order them differently per page, so a row can
      // appear twice or never appear at all.
      orderBy: [{ checkIn: "desc" }, { id: "desc" }],
      ...pageSlice(info),
    }),
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

  // A toggle link for one param that preserves every other filter.
  const hrefWith = (patch: Record<string, string | null>) => {
    const next = new URLSearchParams()
    if (q) next.set("q", q)
    if (employeeId && isHr) next.set("employeeId", employeeId)
    if (status) next.set("status", status)
    if (today === "1") next.set("today", "1")
    for (const [k, v] of Object.entries(patch)) {
      if (v === null) next.delete(k)
      else next.set(k, v)
    }
    const qs = next.toString()
    return qs ? `/attendance?${qs}` : "/attendance"
  }

  const filtered = Boolean(status) || today === "1"

  return (
    <>
      <PageHeader
        eyebrow="Time"
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
          filterEmployee ? (
            <FilterChip
              paramKey="employeeId"
              label={`Employee: ${filterEmployee.firstName} ${filterEmployee.lastName}`}
            />
          ) : undefined
        }
      >
        <div className="flex items-center gap-1.5" aria-label="Quick filters">
          <QuickFilter
            label="Today"
            active={today === "1"}
            href={hrefWith({ today: today === "1" ? null : "1" })}
          />
          <span aria-hidden className="mx-0.5 h-4 w-px bg-border" />
          {EXCEPTIONS.map((s) => (
            <QuickFilter
              key={s}
              label={ATTENDANCE_STATUS_LABEL[s]}
              active={status === s}
              href={hrefWith({ status: status === s ? null : s })}
            />
          ))}
        </div>
      </ListToolbar>

      <DataTable
        columns={columns}
        rows={rows}
        rowKey={(r) => r.id}
        rowHref={(r) => `/attendance/${r.id}`}
        empty={
          <EmptyState
            icon={Clock}
            title={filtered ? "Nothing matches this filter" : "No attendance records"}
            description={
              filtered
                ? "Clear the quick filter to see every record."
                : "Check in from the panel above, or record an entry manually."
            }
            action={
              filtered ? (
                <Link
                  href={hrefWith({ status: null, today: null })}
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Clear filters
                </Link>
              ) : undefined
            }
          />
        }
        footer={<Pagination info={info} />}
      />
    </>
  )
}
