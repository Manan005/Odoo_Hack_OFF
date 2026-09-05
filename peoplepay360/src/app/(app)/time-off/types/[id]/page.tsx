import { Role } from "@prisma/client"
import { Plane, Wallet } from "lucide-react"
import { notFound } from "next/navigation"
import { Forbidden } from "@/components/shared/Forbidden"
import { FormHeader } from "@/components/shared/FormHeader"
import { SmartButtonBar } from "@/components/shared/SmartButtonBar"
import { ActiveBadge } from "@/components/shared/StatusBadge"
import { TypeForm } from "@/components/timeoff/TypeForm"
import { pageAllows } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { UNIT_LABEL } from "@/lib/validation/timeoff"

export default async function TimeOffTypeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const hr = await pageAllows(Role.HR_MANAGER)
  if (!hr) return <Forbidden message="Time off types are managed by HR." />

  const { id } = await params
  const type = await db.timeOffType.findUnique({
    where: { id },
    include: { _count: { select: { allocations: true, requests: true } } },
  })
  if (!type) notFound()

  return (
    <>
      <FormHeader
        breadcrumb="Time Off Types"
        backHref="/time-off/types"
        title={type.name}
        subtitle={`${UNIT_LABEL[type.unit]} · ${
          type.requiresAllocation ? "requires allocation" : "no allocation required"
        }`}
        badge={<ActiveBadge active={type.active} />}
        smartButtons={
          <SmartButtonBar
            buttons={[
              {
                label: "Allocations",
                count: type._count.allocations,
                href: `/time-off/allocations?typeId=${type.id}`,
                icon: Wallet,
              },
              {
                label: "Requests",
                count: type._count.requests,
                href: `/time-off/requests?typeId=${type.id}`,
                icon: Plane,
              },
            ]}
          />
        }
      />

      <TypeForm
        initial={{
          id: type.id,
          name: type.name,
          unit: type.unit,
          requiresAllocation: type.requiresAllocation,
          approvalMode: type.approvalMode,
          workEntryLabel: type.workEntryLabel ?? "",
          isPaid: type.isPaid,
          displayColor: type.displayColor,
          active: type.active,
          description: type.description ?? "",
        }}
      />
    </>
  )
}
