import { RequestStatus } from "@prisma/client"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { RequestForm, emptyRequest, type TypeOption } from "@/components/timeoff/RequestForm"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
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

  const rawTypes = await db.timeOffType.findMany({
    where: { active: true },
    select: { id: true, name: true, unit: true, requiresAllocation: true },
    orderBy: { name: "asc" },
  })

  // Surface the remaining balance per type so the gate is visible before submit.
  const allocations = defaultEmployeeId
    ? await db.timeOffAllocation.findMany({
        where: { employeeId: defaultEmployeeId, status: RequestStatus.APPROVED },
        select: { typeId: true, allocated: true, taken: true },
      })
    : []

  const remainingByType = new Map<string, number>()
  for (const a of allocations) {
    remainingByType.set(
      a.typeId,
      (remainingByType.get(a.typeId) ?? 0) + balanceOf(a).remaining,
    )
  }

  const types: TypeOption[] = rawTypes.map((t) => ({
    ...t,
    remaining: t.requiresAllocation ? (remainingByType.get(t.id) ?? 0) : null,
  }))

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
      />
    </>
  )
}
