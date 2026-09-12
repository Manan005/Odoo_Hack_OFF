"use client"

import { AttendanceStatus } from "@prisma/client"
import { LogIn, LogOut, RotateCcw, Timer, UserX } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useSyncExternalStore, useTransition } from "react"
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

export interface TodayRecord {
  id: string
  checkIn: Date
  checkOut: Date | null
  workedHours: string
  status: AttendanceStatus
}

/**
 * Today's record has four states and the two buttons are true in each:
 *
 *   none    → Check in starts the day.
 *   live    → Check out closes it (the clock runs).
 *   done    → Check in again resumes the same record; hours recount from the
 *             first check-in at the next check-out (BR-A1).
 *   absent  → Check in turns the absence into a presence from now.
 *
 * One record per day, always — the dashboard and payroll count rows per day.
 */
type State = "none" | "live" | "done" | "absent"

function stateOf(today: TodayRecord | null): State {
  if (!today) return "none"
  if (today.status === AttendanceStatus.ABSENT) return "absent"
  return today.checkOut ? "done" : "live"
}

export function CheckInOutWidget({ today }: { today: TodayRecord | null }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState<"in" | "out" | null>(null)

  const state = stateOf(today)
  const live = state === "live"
  const done = state === "done"

  const doCheckIn = () => {
    setBusy("in")
    startTransition(async () => {
      const result = await checkIn()
      if (result.ok) {
        toast.success(result.data.resumed ? "Resumed today's attendance." : "Checked in.")
        router.refresh()
      } else {
        toast.error(result.message ?? "Something went wrong.")
      }
      setBusy(null)
    })
  }

  const doCheckOut = () => {
    setBusy("out")
    startTransition(async () => {
      const result = await checkOut()
      if (result.ok) {
        toast.success(`Checked out — ${formatHours(result.data.workedHours)} h recorded.`)
        router.refresh()
      } else {
        toast.error(result.message ?? "Something went wrong.")
      }
      setBusy(null)
    })
  }

  const caption =
    state === "none"
      ? "No attendance recorded yet — check in when you start."
      : state === "live"
        ? `Checked in at ${fmtTime(today!.checkIn)} · check out when you leave`
        : state === "done"
          ? `Out at ${fmtTime(today!.checkOut)}. Check in again to resume today's record; hours recount at your next check-out.`
          : "Marked absent today. Checking in turns it into a presence from now."

  const checkInTitle = live ? "Already checked in" : undefined
  const checkOutTitle =
    state === "none" || state === "absent"
      ? "Check in first"
      : done
        ? "Already checked out — check in again to resume"
        : undefined

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
                : state === "absent"
                  ? "bg-danger-subtle text-danger ring-danger/20"
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
            ) : state === "absent" ? (
              <UserX className="h-4 w-4" aria-hidden />
            ) : (
              <LogIn className="h-4 w-4" aria-hidden />
            )}
          </span>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              Today
            </p>
            {state === "none" && (
              <p className="mt-0.5 text-sm text-muted-foreground">No attendance recorded yet.</p>
            )}
            {state === "absent" && (
              <p className="mt-0.5 text-sm text-muted-foreground">
                Marked <span className="font-medium text-danger">absent</span> for today.
              </p>
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
              variant={done ? "outline" : live ? "outline" : "primary"}
              disabled={pending || live}
              loading={pending && busy === "in"}
              loadingText={done ? "Resuming…" : "Checking in…"}
              title={checkInTitle}
              onClick={doCheckIn}
            >
              {done ? (
                <RotateCcw className="h-4 w-4" aria-hidden />
              ) : (
                <LogIn className="h-4 w-4" aria-hidden />
              )}
              {done ? "Check in again" : "Check in"}
            </Button>
            <Button
              variant={live ? "primary" : "outline"}
              disabled={pending || !live}
              loading={pending && busy === "out"}
              loadingText="Checking out…"
              title={checkOutTitle}
              onClick={doCheckOut}
            >
              <LogOut className="h-4 w-4" aria-hidden />
              Check out
            </Button>
          </div>
          <p key={caption} className="max-w-md text-right text-[11px] text-muted-foreground animate-fade-in">
            {caption}
          </p>
        </div>
      </div>
    </Surface>
  )
}
