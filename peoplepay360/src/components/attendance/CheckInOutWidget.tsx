"use client"

import { LogIn, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { checkIn, checkOut } from "@/actions/attendance.actions"
import { Button } from "@/components/ui/button"
import { fmtTime } from "@/lib/dates"
import { formatHours } from "@/lib/money"

export function CheckInOutWidget({
  today,
}: {
  today: { id: string; checkIn: Date; checkOut: Date | null; workedHours: string } | null
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()

  const run = (action: () => Promise<{ ok: boolean; message?: string }>, success: string) =>
    startTransition(async () => {
      const result = await action()
      if (result.ok) {
        toast.success(success)
        router.refresh()
      } else {
        toast.error(result.message ?? "Something went wrong.")
      }
    })

  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-4 rounded-lg border border-border bg-surface p-4 shadow-card">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Today
        </p>
        {today ? (
          <p className="mt-1 text-sm">
            In <span className="font-medium tabular">{fmtTime(today.checkIn)}</span>
            {today.checkOut ? (
              <>
                {" · "}Out{" "}
                <span className="font-medium tabular">{fmtTime(today.checkOut)}</span>
                {" · "}
                <span className="font-medium tabular">
                  {formatHours(today.workedHours)}h
                </span>{" "}
                worked
              </>
            ) : (
              <span className="text-muted-foreground"> · still checked in</span>
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No attendance recorded yet.</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={today ? "outline" : "primary"}
          disabled={pending || Boolean(today)}
          loading={pending}
          onClick={() => run(checkIn, "Checked in.")}
        >
          <LogIn className="h-4 w-4" />
          Check In
        </Button>
        <Button
          variant="outline"
          disabled={pending || !today || Boolean(today?.checkOut)}
          onClick={() => run(checkOut, "Checked out.")}
        >
          <LogOut className="h-4 w-4" />
          Check Out
        </Button>
      </div>
    </div>
  )
}
