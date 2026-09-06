import { RequestStatus, TimeOffUnit } from "@prisma/client"
import { Plane } from "lucide-react"
import { RecordStats } from "@/components/employees/RecordStats"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { ApprovalButtons } from "@/components/timeoff/ApprovalButtons"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { fmtDateCompact } from "@/lib/dates"
import { formatDuration } from "@/lib/money"
import { REQUEST_STATUS_LABEL } from "@/lib/validation/timeoff"

export const metadata = { title: "Time Off Requests — PeoplePay360" }

type Row = {
  id: string
  startDate: Date
  endDate: Date
  duration: unknown
  status: RequestStatus
  employee: { firstName: string; lastName: string }
  type: { name: string; unit: TimeOffUnit }
}

const columnsFor = (isHr: boolean): Column<Row>[] => {
  const base: Column<Row>[] = [
    {
      key: "employee",
      header: "Employee",
      render: (r) => `${r.employee.firstName} ${r.employee.lastName}`,
    },
    { key: "type", header: "Type", render: (r) => r.type.name },
    {
      key: "period",
      header: "Period",
      className: "tabular",
      render: (r) => (
        <span>
          {fmtDateCompact(r.startDate)}
          <span className="text-subtle-foreground"> → </span>
          {fmtDateCompact(r.endDate)}
        </span>
      ),
    },
    {
      key: "duration",
      header: "Duration",
      numeric: true,
      render: (r) => (
        <span className="font-medium">{formatDuration(String(r.duration), r.type.unit)}</span>
      ),
    },
    { key: "status", header: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ]

  if (isHr) {
    base.push({
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => <ApprovalButtons id={r.id} kind="request" status={r.status} />,
    })
  }
  return base
}

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string
    employeeId?: string
    typeId?: string
    status?: string
    myTeam?: string
  }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  const { q, employeeId, typeId, status, myTeam } = await searchParams

  const scopedEmployeeId = isHr ? employeeId : (viewer.employeeId ?? "__none__")
  const statusFilter = status && status in RequestStatus ? (status as RequestStatus) : undefined

  const [requests, filterEmployee, filterType] = await Promise.all([
    db.timeOffRequest.findMany({
      where: {
        ...(scopedEmployeeId ? { employeeId: scopedEmployeeId } : {}),
        ...(typeId ? { typeId } : {}),
        ...(statusFilter ? { status: statusFilter } : {}),
        ...(myTeam === "1" && viewer.employeeId
          ? { employee: { managerId: viewer.employeeId } }
          : {}),
        ...(q
          ? {
              OR: [
                { employee: { firstName: { contains: q, mode: "insensitive" as const } } },
                { employee: { lastName: { contains: q, mode: "insensitive" as const } } },
                { type: { name: { contains: q, mode: "insensitive" as const } } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        startDate: true,
        endDate: true,
        duration: true,
        status: true,
        employee: { select: { firstName: true, lastName: true } },
        type: { select: { name: true, unit: true } },
      },
      // Pending first — this list is a work queue for approvers.
      orderBy: [{ status: "asc" }, { startDate: "desc" }],
    }),
    employeeId && isHr
      ? db.employee.findUnique({
          where: { id: employeeId },
          select: { firstName: true, lastName: true },
        })
      : null,
    typeId ? db.timeOffType.findUnique({ where: { id: typeId }, select: { name: true } }) : null,
  ])

  // Over the rows fetched above — nothing invented.
  const pending = requests.filter((r) => r.status === RequestStatus.TO_APPROVE).length
  const approved = requests.filter((r) => r.status === RequestStatus.APPROVED).length

  return (
    <>
      <PageHeader
        eyebrow="Time off"
        title="Time Off Requests"
        subtitle="Approving a request consumes its allocation; refusing releases the days back."
      />

      <ListToolbar
        newHref="/time-off/requests/new"
        newLabel="New request"
        searchPlaceholder="Search requests…"
        chips={
          <>
            {filterEmployee && (
              <FilterChip
                paramKey="employeeId"
                label={`Employee: ${filterEmployee.firstName} ${filterEmployee.lastName}`}
              />
            )}
            {filterType && <FilterChip paramKey="typeId" label={`Type: ${filterType.name}`} />}
            {statusFilter && (
              <FilterChip paramKey="status" label={`Status: ${REQUEST_STATUS_LABEL[statusFilter]}`} />
            )}
            {myTeam === "1" && <FilterChip paramKey="myTeam" label="My Team" />}
          </>
        }
      >
        <RecordStats
          stats={[
            { label: "to approve", value: pending, tone: "warning" },
            { label: "approved", value: approved, tone: "success" },
          ]}
        />
      </ListToolbar>

      <DataTable
        columns={columnsFor(isHr)}
        rows={requests}
        rowKey={(r) => r.id}
        rowHref={(r) => `/time-off/requests/${r.id}`}
        empty={
          <EmptyState
            icon={Plane}
            title="No time off requests"
            description="Requests draw on an allocation when their type requires one."
          />
        }
        footer={<RowCount shown={requests.length} total={requests.length} />}
      />
    </>
  )
}
