"use client"

import { LogIn, LogOut, Timer } from "lucide-react"
import { useRouter } from "next/navigation"
import { useSyncExternalStore, useTransition } from "react"
import { toast } from "sonner"
import { checkIn, checkOut } from "@/actions/attendance.actions"
import { Button } from "@/components/ui/button"
import { NumberTicker } from "@/components/ui/number-ticker"
import { Surface } from "@/components/ui/surface"
import { fmtTime } from "@/lib/dates"
import { formatHours } from "@/lib/money"
import { cn } from "@/lib/utils"

/*
 * One-second clock shared by every subscriber. `now` stays 0 until the first
 * subscriber mounts, which keeps the server render and the first client paint
 * identical ("—"): useSyncExternalStore reads getServerSnapshot while
 * hydrating and only then switches to the live value, so nothing mismatches.
 */
let now = 0
let timer: ReturnType<typeof setInterval> | null = null
const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (timer === null) {
    now = Date.now()
    timer = setInterval(() => {
      now = Date.now()
      listeners.forEach((l) => l())
    }, 1000)
  }
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0 && timer !== null) {
      clearInterval(timer)
      timer = null
    }
  }
}
const getSnapshot = () => now
const getServerSnapshot = () => 0

const pad2 = (n: number) => String(n).padStart(2, "0")

/** "2h 14m 08s" since `since`; "—" until the clock is running on the client. */
function ElapsedClock({ since }: { since: Date }) {
  const tick = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  if (tick === 0) return <span className="tabular text-subtle-foreground">—</span>
  const total = Math.max(0, Math.floor((tick - since.getTime()) / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  return (
    <span className="tabular">
      {h}
      <span className="text-muted-foreground">h </span>
      {pad2(m)}
      <span className="text-muted-foreground">m </span>
      {pad2(s)}
      <span className="text-muted-foreground">s</span>
    </span>
  )
}

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
  const done = Boolean(today?.checkOut)

  const caption = !today
    ? "Not checked in yet today."
    : live
      ? `Checked in at ${fmtTime(today.checkIn)} — check out when you leave`
      : "Already checked out today"

  const checkInTitle = !today
    ? undefined
    : done
      ? "Already checked out today"
      : "Already checked in today"
  const checkOutTitle = !today ? "Check in first" : done ? "Already checked out today" : undefined

  return (
    <Surface className="relative mb-5 overflow-hidden px-5 py-4">
      {live && (
        <span
          aria-hidden
          className="pointer-events-none absolute -left-16 -top-16 h-48 w-48 rounded-full bg-success/10 blur-3xl"
        />
      )}
      <div className="relative flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "relative flex h-12 w-12 items-center justify-center rounded-xl ring-1 ring-inset transition-colors duration-300",
              live
                ? "breathe bg-success-subtle text-success ring-success/25"
                : "bg-surface-muted text-muted-foreground ring-border/70",
            )}
          >
            {live && (
              <span
                aria-hidden
                className="absolute right-0 top-0 flex h-2.5 w-2.5 -translate-y-0.5 translate-x-0.5"
              >
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-70" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-success ring-2 ring-surface" />
              </span>
            )}
            {live ? (
              <Timer className="h-5 w-5" aria-hidden />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden />
            )}
          </span>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Today
            </p>
            {!today && (
              <p className="mt-0.5 text-sm text-muted-foreground">No attendance recorded yet.</p>
            )}
            {today && live && (
              <>
                <p className="mt-0.5 text-[26px] font-semibold leading-none tracking-tight">
                  <ElapsedClock since={today.checkIn} />
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  In <span className="font-medium tabular text-foreground">{fmtTime(today.checkIn)}</span>
                  <span className="text-subtle-foreground"> · </span>
                  <span className="text-success">on the clock</span>
                </p>
              </>
            )}
            {today && done && (
              <>
                <p className="mt-0.5 flex items-baseline gap-1.5 leading-none">
                  <NumberTicker
                    value={formatHours(today.workedHours)}
                    className="font-display text-[28px] font-semibold tracking-tight"
                  />
                  <span className="text-sm text-muted-foreground">hours worked</span>
                </p>
                <p className="mt-1.5 text-xs text-muted-foreground">
                  In <span className="font-medium tabular text-foreground">{fmtTime(today.checkIn)}</span>
                  <span className="text-subtle-foreground"> · </span>
                  Out{" "}
                  <span className="font-medium tabular text-foreground">{fmtTime(today.checkOut)}</span>
                </p>
              </>
            )}
          </div>
        </div>

        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-2">
            <Button
              variant={today ? "outline" : "primary"}
              disabled={pending || Boolean(today)}
              loading={pending && !today}
              loadingText="Checking in…"
              title={checkInTitle}
              onClick={() => run(checkIn, "Checked in.")}
            >
              <LogIn className="h-4 w-4" aria-hidden />
              Check in
            </Button>
            <Button
              variant={live ? "primary" : "outline"}
              disabled={pending || !live}
              loading={pending && live}
              loadingText="Checking out…"
              title={checkOutTitle}
              onClick={() => run(checkOut, "Checked out.")}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Check out
            </Button>
          </div>
          <p key={caption} className="animate-fade-in text-[11px] text-muted-foreground">
            {caption}
          </p>
        </div>
      </div>
    </Surface>
  )
}
