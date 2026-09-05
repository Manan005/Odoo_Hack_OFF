import { CalendarType, Role } from "@prisma/client"
import { CalendarClock } from "lucide-react"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/Forbidden"
import { ListToolbar } from "@/components/shared/ListToolbar"
import { PageHeader } from "@/components/shared/PageHeader"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { formatWeeklyHours } from "@/lib/schedule/hours"

export const metadata = { title: "Working Schedules — PeoplePay360" }

type Row = {
  id: string
  name: string
  calendarType: CalendarType
  daysPerWeek: number
  hoursPerWeek: unknown
  active: boolean
  company: { name: string }
}

const columns: Column<Row>[] = [
  { key: "name", header: "Schedule Name", render: (r) => r.name },
  {
    key: "type",
    header: "Calendar Type",
    render: (r) => (r.calendarType === CalendarType.FIXED ? "Fixed" : "Variable"),
  },
  { key: "days", header: "Days / Week", numeric: true, render: (r) => r.daysPerWeek },
  {
    key: "hours",
    header: "Hours / Week",
    numeric: true,
    render: (r) => formatWeeklyHours(Number(r.hoursPerWeek)),
  },
  { key: "company", header: "Company", render: (r) => r.company.name },
  { key: "status", header: "Status", render: (r) => <ActiveBadge active={r.active} /> },
]

export default async function WorkingSchedulesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Working schedules are managed by HR." />

  const { q } = await searchParams

  const schedules = await db.workingSchedule.findMany({
    where: {
      companyId: hr.companyId,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      calendarType: true,
      daysPerWeek: true,
      hoursPerWeek: true,
      active: true,
      company: { select: { name: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })

  return (
    <>
      <PageHeader
        title="Working Schedules"
        subtitle="Weekly hours are derived from the day pattern, never typed in."
      />

      <ListToolbar
        newHref="/working-schedules/new"
        newLabel="+ New Schedule"
        searchPlaceholder="Search schedules…"
      />

      <DataTable
        columns={columns}
        rows={schedules}
        rowKey={(r) => r.id}
        rowHref={(r) => `/working-schedules/${r.id}`}
        empty={
          <EmptyState
            icon={CalendarClock}
            title="No working schedules yet"
            description="A schedule defines the weekly pattern attendance and payroll measure against."
          />
        }
        footer={<RowCount shown={schedules.length} total={schedules.length} />}
      />
    </>
  )
}
