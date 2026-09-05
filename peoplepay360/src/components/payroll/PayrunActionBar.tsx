"use client"

import { PayrunStatus } from "@prisma/client"
import { BadgeCheck, Banknote, Calculator, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import {
  computePayrun,
  markPayrunPaid,
  sendPayslips,
  validatePayrun,
} from "@/actions/payrun.actions"
import { Button } from "@/components/ui/button"
import { useConfirm } from "@/components/ui/confirm-dialog"

/**
 * Draft → Compute → Validate → Mark Paid → Send. Each button is disabled
 * unless the run is in the state that allows it; the actions re-check
 * server-side, and VALIDATE is additionally gated on blocking warnings.
 */
export function PayrunActionBar({
  payrunId,
  status,
  blockingCount,
}: {
  payrunId: string
  status: PayrunStatus
  blockingCount: number
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const { confirm, dialog } = useConfirm()

  const run = (fn: () => Promise<{ ok: boolean; message?: string }>, success: string) =>
    startTransition(async () => {
      const result = await fn()
      if (result.ok) {
        toast.success(success)
        router.refresh()
      } else {
        toast.error(result.message ?? "Something went wrong.")
      }
    })

  const isPaid = status === PayrunStatus.PAID
  const validateBlocked = blockingCount > 0

  const onCompute = () =>
    startTransition(async () => {
      const result = await computePayrun(payrunId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      const { computed, skipped, blocking } = result.data
      toast.success(
        `Computed ${computed} payslip${computed === 1 ? "" : "s"}` +
          (skipped > 0 ? `, skipped ${skipped} without a contract` : "") +
          (blocking > 0 ? ` — ${blocking} blocking warning${blocking === 1 ? "" : "s"}` : ""),
      )
      router.refresh()
    })

  const onSend = () =>
    startTransition(async () => {
      const result = await sendPayslips(payrunId)
      if (!result.ok) {
        toast.error(result.message)
        return
      }
      const { sent, skipped, failed } = result.data
      const parts = [`${sent} sent`]
      if (skipped.length > 0) parts.push(`${skipped.length} skipped`)
      if (failed.length > 0) parts.push(`${failed.length} failed`)
      const detail = [...skipped, ...failed]
        .map((s) => `${s.employee} — ${s.reason}`)
        .join("; ")
      if (failed.length > 0) toast.error(`${parts.join(", ")}. ${detail}`)
      else if (skipped.length > 0) toast.warning(`${parts.join(", ")}. ${detail}`)
      else toast.success(`${parts.join(", ")}.`)
      router.refresh()
    })

  const onMarkPaid = async () => {
    const ok = await confirm({
      title: "Mark this payrun as paid?",
      description:
        "It becomes a historical record and can no longer be recomputed. Payslips can then be emailed to employees.",
      confirmLabel: "Mark paid",
      tone: "success",
    })
    if (ok) run(() => markPayrunPaid(payrunId), "Payrun marked paid.")
  }

  const onSendConfirm = async () => {
    const ok = await confirm({
      title: "Email every payslip in this payrun?",
      description: "Each employee receives their own payslip PDF at their work email address.",
      confirmLabel: "Send payslips",
    })
    if (ok) onSend()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {dialog}

      <Button disabled={pending || isPaid} loading={pending} loadingText="Computing…" onClick={onCompute}>
        <Calculator className="h-4 w-4" aria-hidden />
        Compute
      </Button>

      <Button
        variant="outline"
        disabled={pending || status !== PayrunStatus.COMPUTED || validateBlocked}
        title={
          validateBlocked
            ? `Resolve ${blockingCount} blocking warning${blockingCount === 1 ? "" : "s"} first`
            : status === PayrunStatus.DRAFT
              ? "Compute the payrun first"
              : undefined
        }
        onClick={() => run(() => validatePayrun(payrunId), "Payrun validated.")}
      >
        <BadgeCheck className="h-4 w-4" aria-hidden />
        Validate
      </Button>

      <Button
        variant="outline"
        disabled={pending || status !== PayrunStatus.VALIDATED}
        title={status !== PayrunStatus.VALIDATED ? "Validate the payrun first" : undefined}
        onClick={onMarkPaid}
      >
        <Banknote className="h-4 w-4" aria-hidden />
        Mark paid
      </Button>

      <Button
        variant="outline"
        disabled={pending || status !== PayrunStatus.PAID}
        title={status !== PayrunStatus.PAID ? "Mark the payrun paid first" : undefined}
        onClick={onSendConfirm}
      >
        <Send className="h-4 w-4" aria-hidden />
        Send payslips
      </Button>
    </div>
  )
}
