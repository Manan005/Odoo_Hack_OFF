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
import { cn } from "@/lib/utils"

type Next = "compute" | "validate" | "pay" | "send" | "done"

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`

/**
 * Draft → Compute → Validate → Mark Paid → Send, as a sticky bar that stays
 * under the nav island while the payslip table scrolls. The next legal
 * transition is the one primary button; the hint on the left says what it
 * will do. Each action re-checks state server-side, and VALIDATE is
 * additionally gated on blocking warnings.
 */
export function PayrunActionBar({
  payrunId,
  status,
  blockingCount,
  payslipCount,
  allSent,
}: {
  payrunId: string
  status: PayrunStatus
  blockingCount: number
  payslipCount: number
  allSent: boolean
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

  const next: Next =
    status === PayrunStatus.DRAFT
      ? "compute"
      : status === PayrunStatus.COMPUTED
        ? "validate"
        : status === PayrunStatus.VALIDATED
          ? "pay"
          : allSent
            ? "done"
            : "send"

  const hint: { title: string; body: string; tone: "primary" | "danger" | "success" } =
    next === "compute"
      ? {
          title: "Next: Compute",
          body: `evaluates every salary rule in the structure for ${plural(payslipCount, "payslip")}.`,
          tone: "primary",
        }
      : next === "validate" && validateBlocked
        ? {
            title: "Validate is blocked",
            body: `${plural(blockingCount, "blocking warning")} to resolve, then recompute.`,
            tone: "danger",
          }
        : next === "validate"
          ? {
              title: "Next: Validate",
              body: "confirms the computed amounts. You can still recompute until the run is paid.",
              tone: "primary",
            }
          : next === "pay"
            ? {
                title: "Next: Mark paid",
                body: "the run becomes a historical record and can no longer be recomputed.",
                tone: "primary",
              }
            : next === "send"
              ? {
                  title: "Next: Send payslips",
                  body: "emails each employee their own payslip PDF.",
                  tone: "primary",
                }
              : {
                  title: "Complete",
                  body: "every payslip in this run is paid and emailed.",
                  tone: "success",
                }

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

  const primary = (step: Next) => (next === step ? "primary" : "outline")

  return (
    <div className="pay-sticky mb-5 flex flex-wrap items-center gap-3 rounded-2xl border border-border/70 px-4 py-2.5 shadow-card">
      {dialog}

      <p className="flex min-w-0 flex-1 items-center gap-2.5 text-xs text-muted-foreground">
        <span
          aria-hidden
          className={cn(
            "pay-beacon inline-flex h-2 w-2 shrink-0 rounded-full",
            hint.tone === "danger"
              ? "bg-danger text-danger"
              : hint.tone === "success"
                ? "bg-success text-success"
                : "bg-primary text-primary",
          )}
        />
        <span className="truncate">
          <span
            className={cn(
              "font-semibold",
              hint.tone === "danger"
                ? "text-danger"
                : hint.tone === "success"
                  ? "text-success"
                  : "text-foreground",
            )}
          >
            {hint.title}
          </span>{" "}
          — {hint.body}
        </span>
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant={primary("compute")}
          disabled={pending || isPaid}
          loading={pending}
          loadingText="Computing…"
          title={isPaid ? "A paid run is a historical record" : undefined}
          onClick={onCompute}
        >
          <Calculator className="h-4 w-4" aria-hidden />
          {status === PayrunStatus.DRAFT ? "Compute" : "Recompute"}
        </Button>

        <Button
          variant={primary("validate")}
          disabled={pending || status !== PayrunStatus.COMPUTED || validateBlocked}
          title={
            validateBlocked
              ? `Resolve ${plural(blockingCount, "blocking warning")} first`
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
          variant={primary("pay")}
          disabled={pending || status !== PayrunStatus.VALIDATED}
          title={status !== PayrunStatus.VALIDATED ? "Validate the payrun first" : undefined}
          onClick={onMarkPaid}
        >
          <Banknote className="h-4 w-4" aria-hidden />
          Mark paid
        </Button>

        <Button
          variant={primary("send")}
          disabled={pending || status !== PayrunStatus.PAID}
          title={status !== PayrunStatus.PAID ? "Mark the payrun paid first" : undefined}
          onClick={onSendConfirm}
        >
          <Send className="h-4 w-4" aria-hidden />
          {allSent ? "Resend payslips" : "Send payslips"}
        </Button>
      </div>
    </div>
  )
}
