"use client"

import { RequestStatus } from "@prisma/client"
import { Check, X } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import {
  approveAllocation,
  approveRequest,
  refuseAllocation,
  refuseRequest,
} from "@/actions/timeoff.actions"
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
  const { confirm, dialog } = useConfirm()
  const { approve, refuse } = ACTIONS[kind]

  const run = (fn: (id: string) => Promise<ActionResult<{ id: string }>>, success: string) =>
    startTransition(async () => {
      const result = await fn(id)
      if (result.ok) {
        toast.success(success)
        router.refresh()
      } else {
        toast.error(result.message)
      }
    })

  const onRefuse = async () => {
    if (status === RequestStatus.APPROVED) {
      const ok = await confirm({
        title: "Refuse an approved record?",
        description: "The consumed balance is released back to the allocation.",
        confirmLabel: "Refuse",
        tone: "danger",
      })
      if (!ok) return
    }
    run(refuse, "Refused — any consumed balance has been released.")
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {dialog}
      <Button
        size={size}
        variant="success"
        disabled={pending || status === RequestStatus.APPROVED}
        onClick={() => run(approve, "Approved.")}
      >
        <Check className="h-3.5 w-3.5" aria-hidden />
        Approve
      </Button>
      <Button
        size={size}
        variant="danger"
        disabled={pending || status === RequestStatus.REFUSED}
        onClick={onRefuse}
      >
        <X className="h-3.5 w-3.5" aria-hidden />
        Refuse
      </Button>
    </span>
  )
}
