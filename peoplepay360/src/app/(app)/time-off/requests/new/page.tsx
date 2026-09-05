import { RequestStatus } from "@prisma/client"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import {
  RequestForm,
  type RemainingByEmployee,
  type TypeOption,
} from "@/components/timeoff/RequestForm"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { emptyRequest } from "@/lib/form-defaults"
import { balanceOf } from "@/lib/timeoff/balance"

export const metadata = { title: "New Time Off Request — PeoplePay360" }

export default async function NewRequestPage({
  searchParams,
}: {
  searchParams: Promise<{ employeeId?: string }>
}) {
  const viewer = await pageUser()
  if (!viewer) return <Forbidden />

  const isHr = rankOf(viewer.roles) >= ROLE_RANK.HR_MANAGER
  const { employeeId } = await searchParams
  const defaultEmployeeId = isHr ? (employeeId ?? "") : (viewer.employeeId ?? "")

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

  const types: TypeOption[] = await db.timeOffType.findMany({
    where: { active: true },
    select: { id: true, name: true, unit: true, requiresAllocation: true },
    orderBy: { name: "asc" },
  })

  // Balances for every employee the viewer may pick, not just the one this
  // page was rendered for — the employee is chosen inside the form, and a
  // figure computed for someone else is worse than none.
  const allocations =
    employees.length > 0
      ? await db.timeOffAllocation.findMany({
          where: {
            employeeId: { in: employees.map((e) => e.id) },
            status: RequestStatus.APPROVED,
          },
          select: { employeeId: true, typeId: true, allocated: true, taken: true },
        })
      : []

  const remaining: RemainingByEmployee = {}
  for (const a of allocations) {
    const perType = (remaining[a.employeeId] ??= {})
    perType[a.typeId] = Number(
      ((perType[a.typeId] ?? 0) + balanceOf(a).remaining).toFixed(2),
    )
  }

  return (
    <>
      <PageHeader
        title="New Time Off Request"
        subtitle="Duration counts only working days on the employee's schedule."
      />
      <RequestForm
        initial={{ ...emptyRequest, employeeId: defaultEmployeeId }}
        employees={employees}
        types={types}
        remaining={remaining}
      />
    </>
  )
}
