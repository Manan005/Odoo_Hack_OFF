import { Role } from "@prisma/client"
import { ShieldCheck } from "lucide-react"
import { RecordStats } from "@/components/employees/RecordStats"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { FilterChip, ListToolbar } from "@/components/shared/ListToolbar"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/Forbidden"
import { ActiveBadge, StatusBadge } from "@/components/shared/StatusBadge"
import { ROLE_LABEL, pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "User Management — PeoplePay360" }

type Row = {
  id: string
  email: string
  roles: Role[]
  active: boolean
  employee: { firstName: string; lastName: string } | null
}

const columns: Column<Row>[] = [
  {
    key: "user",
    header: "User",
    render: (r) =>
      r.employee ? `${r.employee.firstName} ${r.employee.lastName}` : r.email,
  },
  {
    key: "email",
    header: "Work Email",
    render: (r) => <span className="font-mono text-[13px]">{r.email}</span>,
  },
  {
    key: "employee",
    header: "Employee",
    render: (r) =>
      r.employee ? (
        `${r.employee.firstName} ${r.employee.lastName}`
      ) : (
        <span className="text-muted-foreground">— not linked</span>
      ),
  },
  {
    key: "roles",
    header: "Roles",
    // Role is an enum without a colour mapping, so StatusBadge falls back to
    // its neutral ring chip — one chip family across the app, no ad-hoc spans.
    render: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.roles.map((role) => (
          <StatusBadge key={role} status={ROLE_LABEL[role]} />
        ))}
      </span>
    ),
  },
  { key: "status", header: "Status", render: (r) => <ActiveBadge active={r.active} /> },
]

export default async function UsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; role?: string }>
}) {
  // Page-level guard; the actions guard again independently (rules.md §4).
  const actor = await pageAllows(Role.ADMIN)
  if (!actor) return <Forbidden message="User management is restricted to administrators." />

  const { q, role } = await searchParams
  const roleFilter = role && role in Role ? (role as Role) : undefined

  const users = await db.user.findMany({
    where: {
      ...(roleFilter ? { roles: { has: roleFilter } } : {}),
      ...(q
        ? {
            OR: [
              { email: { contains: q, mode: "insensitive" as const } },
              { employee: { firstName: { contains: q, mode: "insensitive" as const } } },
              { employee: { lastName: { contains: q, mode: "insensitive" as const } } },
            ],
          }
        : {}),
    },
    select: {
      id: true,
      email: true,
      roles: true,
      active: true,
      employee: { select: { firstName: true, lastName: true } },
    },
    orderBy: { email: "asc" },
  })

  // Over the rows fetched above — nothing invented.
  const activeCount = users.filter((u) => u.active).length

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="User Management"
        subtitle="Admin only — create accounts, link them to employees, and assign roles."
      />

      <ListToolbar
        newHref="/users/new"
        newLabel="New user"
        searchPlaceholder="Search users, employees or email…"
        chips={
          roleFilter ? (
            <FilterChip paramKey="role" label={`Role: ${ROLE_LABEL[roleFilter]}`} />
          ) : undefined
        }
      >
        <RecordStats
          stats={[
            { label: "users", value: users.length, tone: "primary" },
            { label: "active", value: activeCount, tone: "success" },
          ]}
        />
      </ListToolbar>

      <DataTable
        columns={columns}
        rows={users}
        rowKey={(r) => r.id}
        rowHref={(r) => `/users/${r.id}`}
        empty={
          <EmptyState
            icon={ShieldCheck}
            title="No users match"
            description="User accounts are created by an administrator and linked to an employee record."
          />
        }
        footer={<RowCount shown={users.length} total={users.length} />}
      />
    </>
  )
}
