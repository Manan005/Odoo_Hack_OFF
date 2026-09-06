"use client"

import { RequestStatus } from "@prisma/client"
import { Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  approveAllocation,
  approveRequest,
  refuseAllocation,
  refuseRequest,
} from "@/actions/timeoff.actions"
import { StatusBadge } from "@/components/shared/StatusBadge"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"
import type { ActionResult } from "@/lib/result"

type Kind = "allocation" | "request"

const ACTIONS: Record<
  Kind,
  {
    approve: (id: string) => Promise<ActionResult<{ id: string }>>
    refuse: (id: string) => Promise<ActionResult<{ id: string }>>
  }
> = {
  allocation: { approve: approveAllocation, refuse: refuseAllocation },
  request: { approve: approveRequest, refuse: refuseRequest },
}

// What each confirm explains. The rules themselves live in lib/timeoff.
const COPY: Record<Kind, { approve: string; refuse: string; refuseApproved: string }> = {
  request: {
    approve: "The duration is deducted from the allocation this request draws on.",
    refuse: "The request is closed and nothing is deducted.",
    refuseApproved: "The consumed balance is released back to the allocation.",
  },
  allocation: {
    approve: "The balance becomes available for time off requests of this type.",
    refuse: "No balance is granted from this allocation.",
    refuseApproved: "The balance is withdrawn — allowed only while nothing has been taken from it.",
  },
}

/**
 * Approve / Refuse pair shared by the allocation and request lists. The
 * balance rules are enforced in the action, not here — this only reports.
 */
export function ApprovalButtons({
  id,
  kind,
  status,
  size = "sm",
}: {
  id: string
  kind: Kind
  status: RequestStatus
  size?: "sm" | "md"
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [pop, setPop] = useState<RequestStatus | null>(null)
  const { confirm, dialog } = useConfirm()
  const { approve, refuse } = ACTIONS[kind]

  const run = (
    fn: (id: string) => Promise<ActionResult<{ id: string }>>,
    success: string,
    landed: RequestStatus,
  ) =>
    startTransition(async () => {
      const result = await fn(id)
      if (result.ok) {
        toast.success(success)
        setPop(landed)
        setTimeout(() => setPop(null), 1600)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })

  const onApprove = async () => {
    const ok = await confirm({
      title: `Approve this ${kind}?`,
      description: COPY[kind].approve,
      confirmLabel: "Approve",
      tone: "success",
    })
    if (!ok) return
    run(approve, "Approved.", RequestStatus.APPROVED)
  }

  const onRefuse = async () => {
    const wasApproved = status === RequestStatus.APPROVED
    const ok = await confirm({
      title: wasApproved ? `Refuse an approved ${kind}?` : `Refuse this ${kind}?`,
      description: wasApproved ? COPY[kind].refuseApproved : COPY[kind].refuse,
      confirmLabel: "Refuse",
      tone: "danger",
    })
    if (!ok) return
    run(
      refuse,
      wasApproved ? "Refused — any consumed balance has been released." : "Refused.",
      RequestStatus.REFUSED,
    )
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {dialog}
      {pop && <StatusBadge status={pop} className="pop-in" />}
      <Button
        size={size}
        variant="success"
        disabled={pending || status === RequestStatus.APPROVED}
        title={status === RequestStatus.APPROVED ? "Already approved" : undefined}
        onClick={onApprove}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Approve
      </Button>
      <Button
        size={size}
        variant="danger"
        disabled={pending || status === RequestStatus.REFUSED}
        title={status === RequestStatus.REFUSED ? "Already refused" : undefined}
        onClick={onRefuse}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Refuse
      </Button>
    </span>
  )
}
