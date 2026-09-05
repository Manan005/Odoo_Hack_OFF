"use client"

import { PayrunStatus } from "@prisma/client"
import { BadgeCheck, Banknote, Calculator, Send } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { computePayrun, markPayrunPaid, validatePayrun } from "@/actions/payrun.actions"
import { Button } from "@/components/ui/button"

/**
 * Draft → Compute → Validate → Mark Paid. Each button is disabled unless the
 * run is in the state that allows it; the actions re-check server-side.
 */
export function PayrunActionBar({
  payrunId,
  status,
}: {
  payrunId: string
  status: PayrunStatus
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

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

  const confirmThen = (message: string, fn: () => void) => () => {
    if (confirm(message)) fn()
  }

  const isPaid = status === PayrunStatus.PAID

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button
        disabled={pending || isPaid}
        loading={pending}
        loadingText="Computing…"
        onClick={() =>
          run(() => computePayrun(payrunId), "Payslips computed from the salary rules.")
        }
      >
        <Calculator className="h-4 w-4" />
        COMPUTE
      </Button>

      <Button
        variant="outline"
        disabled={pending || status !== PayrunStatus.COMPUTED}
        title={
          status === PayrunStatus.DRAFT ? "Compute the payrun first" : undefined
        }
        onClick={() => run(() => validatePayrun(payrunId), "Payrun validated.")}
      >
        <BadgeCheck className="h-4 w-4" />
        VALIDATE
      </Button>

      <Button
        variant="outline"
        disabled={pending || status !== PayrunStatus.VALIDATED}
        title={status !== PayrunStatus.VALIDATED ? "Validate the payrun first" : undefined}
        onClick={confirmThen(
          "Mark this payrun as paid? It becomes a historical record and can no longer be recomputed.",
          () => run(() => markPayrunPaid(payrunId), "Payrun marked paid."),
        )}
      >
        <Banknote className="h-4 w-4" />
        MARK PAID
      </Button>

      <Button
        variant="outline"
        disabled
        title="Bulk payslip email arrives in P7"
      >
        <Send className="h-4 w-4" />
        SEND PAYSLIPS
      </Button>
    </div>
  )
}
