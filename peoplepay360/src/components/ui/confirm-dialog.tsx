"use client"

import { AlertTriangle, CheckCircle2, HelpCircle } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ConfirmTone = "primary" | "danger" | "success"

export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ConfirmTone
}

const TONE_ICON = { primary: HelpCircle, danger: AlertTriangle, success: CheckCircle2 } as const
const TONE_TILE = {
  primary: "bg-primary-subtle text-primary ring-primary/20",
  danger: "bg-danger-subtle text-danger ring-danger/20",
  success: "bg-success-subtle text-success ring-success/20",
} as const

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  tone = "primary",
  onConfirm,
  onCancel,
}: ConfirmOptions & { open: boolean; onConfirm: () => void; onCancel: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)

  // Native <dialog> gives focus trapping and Escape handling for free.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (open && !el.open) el.showModal()
    if (!open && el.open) el.close()
  }, [open])

  const Icon = TONE_ICON[tone]

  return (
    <dialog
      ref={ref}
      onClose={onCancel}
      onClick={(e) => {
        // Click on the backdrop (the dialog element itself, not its content).
        if (e.target === e.currentTarget) onCancel()
      }}
      className="w-full max-w-md rounded-2xl border border-border/70 bg-surface p-0 text-foreground shadow-modal backdrop:bg-transparent"
    >
      <div className="p-6">
        <span
          className={cn(
            "inline-flex h-11 w-11 items-center justify-center rounded-xl ring-1",
            TONE_TILE[tone],
          )}
        >
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <h2 className="mt-4 text-lg font-semibold tracking-tight">{title}</h2>
        {description && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
        )}
      </div>
      <footer className="flex items-center justify-end gap-2 border-t border-border/70 bg-surface-muted/50 px-6 py-4">
        <Button variant="ghost" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          variant={tone === "danger" ? "danger-solid" : tone === "success" ? "success" : "primary"}
          onClick={onConfirm}
          autoFocus
        >
          {confirmLabel}
        </Button>
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
  const [opts, setOpts] = useState<ConfirmOptions | null>(null)
  const resolver = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        resolver.current = resolve
        setOpts(options)
      }),
    [],
  )

  const settle = useCallback((v: boolean) => {
    resolver.current?.(v)
    resolver.current = null
    setOpts(null)
  }, [])

  const dialog = (
    <ConfirmDialog
      open={opts !== null}
      title={opts?.title ?? ""}
      description={opts?.description}
      confirmLabel={opts?.confirmLabel}
      cancelLabel={opts?.cancelLabel}
      tone={opts?.tone}
      onConfirm={() => settle(true)}
      onCancel={() => settle(false)}
    />
  )

  return { confirm, dialog }
}
