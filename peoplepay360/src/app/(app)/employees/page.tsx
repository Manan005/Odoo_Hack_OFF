import { Role } from "@prisma/client"
import { Users } from "lucide-react"
import { redirect } from "next/navigation"
import { EmployeeKanban } from "@/components/employees/EmployeeKanban"
import { RecordStats } from "@/components/employees/RecordStats"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { PageHeader } from "@/components/shared/PageHeader"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { Surface } from "@/components/ui/surface"
import { pageAllows, pageUser } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "Employees — PeoplePay360" }

type Row = {
  id: string
  firstName: string
  lastName: string
  employeeCode: string
  workEmail: string | null
  active: boolean
  department: { name: string } | null
  jobPosition: { name: string } | null
}

const columns: Column<Row>[] = [
  { key: "employee", header: "Employee", render: (r) => `${r.firstName} ${r.lastName}` },
  {
    key: "code",
    header: "Code",
    render: (r) => <span className="font-mono text-[13px] text-muted-foreground">{r.employeeCode}</span>,
  },
  {
    key: "workEmail",
    header: "Work Email",
    render: (r) => r.workEmail ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: "position",
    header: "Job Position",
    render: (r) => r.jobPosition?.name ?? <span className="text-muted-foreground">—</span>,
  },
  {
    key: "department",
    header: "Department",
    render: (r) => r.department?.name ?? <span className="text-muted-foreground">—</span>,
  },
  { key: "status", header: "Status", render: (r) => <ActiveBadge active={r.active} /> },
]

const initialsOf = (first: string, last: string) =>
  `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase()

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    view?: string
    q?: string
    departmentId?: string
    jobPositionId?: string
  }>
}) {
  // EMPLOYEE-rank users have no business on the full roster (AC-M1-4) —
  // send them to their own record instead.
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) {
    const me = await pageUser()
    redirect(me?.employeeId ? `/employees/${me.employeeId}` : "/login")
  }

  const { view = "kanban", q, departmentId, jobPositionId } = await searchParams

  const [employees, filterDepartment, filterPosition] = await Promise.all([
    db.employee.findMany({
      where: {
        companyId: hr.companyId,
        ...(departmentId ? { departmentId } : {}),
        ...(jobPositionId ? { jobPositionId } : {}),
        ...(q
          ? {
              OR: [
                { firstName: { contains: q, mode: "insensitive" as const } },
                { lastName: { contains: q, mode: "insensitive" as const } },
                { workEmail: { contains: q, mode: "insensitive" as const } },
                { employeeCode: { contains: q, mode: "insensitive" as const } },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        employeeCode: true,
        workEmail: true,
        active: true,
        department: { select: { name: true } },
        jobPosition: { select: { name: true } },
      },
      orderBy: [{ active: "desc" }, { firstName: "asc" }],
    }),
    departmentId
      ? db.department.findUnique({ where: { id: departmentId }, select: { name: true } })
      : null,
    jobPositionId
      ? db.jobPosition.findUnique({ where: { id: jobPositionId }, select: { name: true } })
      : null,
  ])

  // Counts over the rows this page fetched — nothing invented (rules.md §6).
  const activeCount = employees.filter((e) => e.active).length
  const filtered = Boolean(q || departmentId || jobPositionId)

  const empty = (
    <EmptyState
      icon={Users}
      title={filtered ? "No employees match" : "No employees yet"}
      description="The employee record is the hub every contract, attendance entry and payslip hangs off."
    />
  )

  return (
    <>
      <PageHeader
        eyebrow="People"
        title="Employees"
        subtitle={
          view === "list"
            ? "List view for sort, filter and bulk scanning"
            : "Kanban for browsing — every card opens the same record"
        }
      />

      <ListToolbar
        newHref="/employees/new"
        newLabel="New employee"
        searchPlaceholder="Search employees…"
        chips={
          <>
            {filterDepartment && (
              <FilterChip paramKey="departmentId" label={`Department: ${filterDepartment.name}`} />
            )}
            {filterPosition && (
              <FilterChip paramKey="jobPositionId" label={`Position: ${filterPosition.name}`} />
            )}
          </>
        }
        views={[
          { key: "kanban", label: "Kanban" },
          { key: "list", label: "List" },
        ]}
      >
        <RecordStats
          stats={[
            { label: filtered ? "matching" : "employees", value: employees.length, tone: "primary" },
            { label: "active", value: activeCount, tone: "success" },
          ]}
        />
      </ListToolbar>

      {view === "list" ? (
        <DataTable
          columns={columns}
          rows={employees}
          rowKey={(r) => r.id}
          rowHref={(r) => `/employees/${r.id}`}
          empty={empty}
          footer={<RowCount shown={employees.length} total={employees.length} />}
        />
      ) : employees.length === 0 ? (
        <Surface>{empty}</Surface>
      ) : (
        <EmployeeKanban
          employees={employees.map((e) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`,
            initials: initialsOf(e.firstName, e.lastName),
            position: e.jobPosition?.name ?? null,
            department: e.department?.name ?? null,
            workEmail: e.workEmail,
            active: e.active,
          }))}
        />
      )}
    </>
  )
}
