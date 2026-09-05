"use client"

import { LogIn, LogOut } from "lucide-react"
import { useRouter } from "next/navigation"
import { useTransition } from "react"
import { toast } from "sonner"
import { checkIn, checkOut } from "@/actions/attendance.actions"
import { Button } from "@/components/ui/button"
import { Surface } from "@/components/ui/surface"
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

  const live = Boolean(today && !today.checkOut)

  return (
    <Surface className="mb-5 flex flex-wrap items-center justify-between gap-4 px-5 py-4">
      <div className="flex items-center gap-4">
        <span className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-surface-muted ring-1 ring-inset ring-border/70">
          {live && (
            <span
              aria-hidden
              className="absolute right-0 top-0 flex h-2.5 w-2.5 -translate-y-0.5 translate-x-0.5"
            >
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" />
            </span>
          )}
          <LogIn className="h-4 w-4 text-muted-foreground" aria-hidden />
        </span>
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
            Today
          </p>
          {today ? (
            <p className="mt-0.5 text-sm">
              In <span className="font-medium tabular">{fmtTime(today.checkIn)}</span>
              {today.checkOut ? (
                <>
                  <span className="text-subtle-foreground"> · </span>Out{" "}
                  <span className="font-medium tabular">{fmtTime(today.checkOut)}</span>
                  <span className="text-subtle-foreground"> · </span>
                  <span className="font-medium tabular">{formatHours(today.workedHours)}h</span>{" "}
                  worked
                </>
              ) : (
                <span className="text-success"> · checked in</span>
              )}
            </p>
          ) : (
            <p className="mt-0.5 text-sm text-muted-foreground">No attendance recorded yet.</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          variant={today ? "outline" : "primary"}
          disabled={pending || Boolean(today)}
          loading={pending && !today}
          loadingText="Checking in…"
          onClick={() => run(checkIn, "Checked in.")}
        >
          <LogIn className="h-4 w-4" aria-hidden />
          Check in
        </Button>
        <Button
          variant={live ? "primary" : "outline"}
          disabled={pending || !today || Boolean(today?.checkOut)}
          loading={pending && live}
          loadingText="Checking out…"
          onClick={() => run(checkOut, "Checked out.")}
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Check out
        </Button>
      </div>
    </Surface>
  )
}
