import { Role } from "@prisma/client"
import { ShieldCheck } from "lucide-react"
import Link from "next/link"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { ListToolbar } from "@/components/shared/ListToolbar"
import { PageHeader } from "@/components/shared/PageHeader"
import { Forbidden } from "@/components/shared/Forbidden"
import { ActiveBadge } from "@/components/shared/StatusBadge"
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
    key: "email",
    header: "Work Email",
    render: (r) => <span className="font-mono text-[13px]">{r.email}</span>,
  },
  {
    key: "roles",
    header: "Role",
    render: (r) => (
      <span className="flex flex-wrap gap-1">
        {r.roles.map((role) => (
          <span
            key={role}
            className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground ring-1 ring-inset ring-border/60"
          >
            {ROLE_LABEL[role]}
          </span>
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

  const users = await db.user.findMany({
    where: {
      ...(role && role in Role ? { roles: { has: role as Role } } : {}),
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

  return (
    <>
      <PageHeader
        title="User Management"
        subtitle="Admin only — create accounts, link them to employees, and assign roles."
      />

      <ListToolbar
        newHref="/users/new"
        newLabel="New user"
        searchPlaceholder="Search users, employees or email…"
      >
        <Link
          href="/users"
          className="text-xs text-muted-foreground hover:text-primary"
        >
          Clear filters
        </Link>
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
