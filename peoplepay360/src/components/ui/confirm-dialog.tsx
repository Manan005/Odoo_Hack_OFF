"use client"

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react"
import { useCallback, useEffect, useId, useRef, useState } from "react"
import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConfirmTone = "primary" | "danger" | "success"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
  /**
   * The confirm button must be held for ~900 ms — a progress fill sweeps
   * across it and confirm fires when the fill completes. For the handful of
   * actions that rewrite history (Mark Paid, Refuse); a click stays the
   * default everywhere else.
   */
  hold?: boolean
}

const TONE_ICON = { primary: HelpCircle, danger: AlertTriangle, success: CheckCircle2 } as const
const TONE_TILE = {
  primary: "bg-primary-subtle text-primary ring-primary/20",
  danger: "bg-danger-subtle text-danger ring-danger/20",
  success: "bg-success-subtle text-success ring-success/20",
} as const
const TONE_BUTTON: Record<ConfirmTone, ButtonProps["variant"]> = {
  primary: "primary",
  danger: "danger-solid",
  success: "success",
}

const EXIT_MS = 160

/** Footer buttons: half the row and 40px tall on a phone, natural size from `sm`. */
const footerButton = "min-h-10 flex-1 sm:min-h-0 sm:flex-none"

/**
 * Press-and-hold confirm. The fill is a CSS animation started by the
 * `data-holding` attribute and cancelled the moment the pointer (or key)
 * lets go; the action fires on `animationend`, never on click.
 */
function HoldButton({
  variant,
  onConfirm,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & { onConfirm: () => void }) {
  const [holding, setHolding] = useState(false)
  const stop = () => setHolding(false)
  const isActivationKey = (key: string) => key === "Enter" || key === " "

  return (
    <Button
      variant={variant}
      aria-description="Hold to confirm"
      title="Hold to confirm"
      data-holding={holding || undefined}
      onPointerDown={(e) => {
        if (e.button === 0) setHolding(true)
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onKeyDown={(e) => {
        if (!isActivationKey(e.key)) return
        e.preventDefault()
        if (!e.repeat) setHolding(true)
      }}
      onKeyUp={(e) => {
        if (!isActivationKey(e.key)) return
        e.preventDefault()
        stop()
      }}
      onAnimationEnd={(e) => {
        if (e.animationName !== "hold-fill") return
        stop()
        onConfirm()
      }}
      {...props}
    >
      <span className="hold-fill" aria-hidden />
      <span className="relative z-[1]">{children}</span>
    </Button>
  )
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  hold = false,
  onConfirm,
  onCancel,
}: ConfirmOptions & { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()
  const descId = useId()

  // Native <dialog> gives focus trapping and Escape handling for free. Closing
  // plays `dialog-out` first, then closes for real on animationend.
  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (open) {
      if (!el.open) {
        el.showModal()
        // Deterministic initial focus: Cancel for destructive tones so Enter
        // can never destroy; the confirm button otherwise.
        el.querySelector<HTMLElement>("[data-autofocus]")?.focus()
      }
      return
    }

    if (!el.open) return
    el.setAttribute("data-closing", "")
    let done = false
    const finish = () => {
      if (done) return
      done = true
      el.removeAttribute("data-closing")
      if (el.open) el.close()
    }
    const onEnd = (e: AnimationEvent) => {
      if (e.target === el && e.animationName === "dialog-out") finish()
    }
    el.addEventListener("animationend", onEnd)
    // Reduced motion collapses the animation to ~0 ms; this is the safety net.
    const timer = setTimeout(finish, EXIT_MS + 80)
    return () => {
      clearTimeout(timer)
      el.removeEventListener("animationend", onEnd)
      finish()
    }
  }, [open])

  const Icon = TONE_ICON[tone]
  const danger = tone === "danger"

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descId : undefined}
      onClose={onCancel}
      onCancel={(e) => {
        // Escape: route through the animated close instead of the instant one.
        e.preventDefault()
        onCancel()
      }}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, not its content).
        if (e.target === e.currentTarget) onCancel()
      }}
      // `text-left`: a <dialog> paints in the top layer but still inherits from
      // its DOM parent, and useConfirm() mounts this wherever the trigger lives
      // — inside a right-aligned table cell for row actions, which otherwise
      // right-aligns the icon, title and description.
      // `max-w-none` below `sm`: the UA caps a modal dialog at
      // calc(100% - 6px - 2em), which would shave the phone width.
      className="w-[calc(100vw-1.5rem)] max-w-none overflow-hidden rounded-2xl border border-border/70 bg-surface p-0 text-left text-base font-normal text-foreground shadow-modal sm:w-full sm:max-w-md"
    >
      <div className="stagger p-5 sm:p-6">
        <span
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1",
            TONE_TILE[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h2 id={titleId} className="mt-4 font-display text-xl font-semibold tracking-tight">
          {title}
        </h2>
        {description && (
          <p id={descId} className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        )}
      </div>
      {/* On a phone the two buttons share the row as 40px-tall halves and the
          hold hint takes a line above them; from `sm` they sit at their
          natural size on the right with the hint on the left. */}
      <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-border/70 bg-surface-muted/50 px-5 py-3.5 sm:px-6 sm:py-4">
        {hold && (
          <span className="w-full text-xs text-subtle-foreground sm:mr-auto sm:w-auto">
            Press and hold to confirm
          </span>
        )}
        <Button
          variant="ghost"
          className={footerButton}
          onClick={onCancel}
          data-autofocus={danger || undefined}
        >
          {cancelLabel}
        </Button>
        {hold ? (
          <HoldButton
            variant={TONE_BUTTON[tone]}
            className={footerButton}
            onConfirm={onConfirm}
            data-autofocus={!danger || undefined}
          >
            {confirmLabel}
          </HoldButton>
        ) : (
          <Button
            variant={TONE_BUTTON[tone]}
            className={footerButton}
            onClick={onConfirm}
            data-autofocus={!danger || undefined}
          >
            {confirmLabel}
          </Button>
        )}
      </footer>
    </dialog>
  )
}

/**
 * Promise-based confirm that replaces `window.confirm`.
 *
 *   const { confirm, dialog } = useConfirm()
 *   if (await confirm({ title: "Mark paid?" })) …
 *   return <>{dialog}…</>
 */
export function useConfirm() {
  // `opts` outlives `open` so the exit animation keeps its text.
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const [open, setOpen] = useState(false)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpts(options)
        setOpen(true)
      }),
    [],
  )

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpen(false)
  }, [])

  const dialog = (
    <ConfirmDialog
      open={open}
      title={opts?.title ?? ""}
      description={opts?.description}
      confirmLabel={opts?.confirmLabel}
      cancelLabel={opts?.cancelLabel}
      tone={opts?.tone}
      hold={opts?.hold}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return { confirm, dialog }
}
