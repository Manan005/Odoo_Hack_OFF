import { Role } from "@prisma/client"
import { Layers } from "lucide-react"
import { Column, DataTable, RowCount } from "@/components/shared/DataTable"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/Forbidden"
import { ListToolbar } from "@/components/shared/ListToolbar"
import { PageHeader } from "@/components/shared/PageHeader"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { canEditSalaryConfig, pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export const metadata = { title: "Salary Structures — PeoplePay360" }

type Row = {
  id: string
  name: string
  active: boolean
  note: string | null
  _count: { rules: number; contracts: number; payruns: number }
}

const columns: Column<Row>[] = [
  { key: "name", header: "Structure Name", render: (r) => r.name },
  {
    key: "rules",
    header: "Rules",
    numeric: true,
    render: (r) => `${r._count.rules} rules`,
  },
  {
    key: "employees",
    header: "Employees",
    numeric: true,
    render: (r) => `${r._count.contracts} employees`,
  },
  { key: "payruns", header: "Payruns", numeric: true, render: (r) => r._count.payruns },
  { key: "status", header: "Active", render: (r) => <ActiveBadge active={r.active} /> },
]

export default async function StructuresPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>
}) {
  const user = await pageAllows(Role.HR_PAYROLL_USER)
  if (!user) return <Forbidden message="Salary structures are restricted to payroll roles." />

  const { q } = await searchParams

  const structures = await db.salaryStructure.findMany({
    where: {
      companyId: user.companyId,
      ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    },
    select: {
      id: true,
      name: true,
      active: true,
      note: true,
      _count: { select: { rules: true, contracts: true, payruns: true } },
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
  })

  return (
    <>
      <PageHeader
        title="Salary Structures"
        subtitle="The structure chosen on a payrun decides which rules compute its payslips."
      />

      <ListToolbar
        newHref={canEditSalaryConfig(user) ? "/payroll/structures/new" : undefined}
        searchPlaceholder="Search structures…"
      />

      <DataTable
        columns={columns}
        rows={structures}
        rowKey={(r) => r.id}
        rowHref={(r) => `/payroll/structures/${r.id}`}
        empty={
          <EmptyState
            icon={Layers}
            title="No salary structures yet"
            description="A structure holds the ordered set of rules that produce a payslip."
          />
        }
        footer={<RowCount shown={structures.length} total={structures.length} />}
      />
    </>
  )
}
