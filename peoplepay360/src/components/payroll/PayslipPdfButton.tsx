"use client"

import { Check, Printer } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"

type State = "idle" | "loading" | "done"

/**
 * Download with a real pending state. The PDF is fetched, then handed to the
 * browser as a file — so the button can show "Preparing…" for as long as the
 * render actually takes and tick when the file has landed.
 */
export function PayslipPdfButton({
  payslipId,
  fallbackName,
}: {
  payslipId: string
  fallbackName: string
}) {
  const [state, setState] = useState<State>("idle")
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    [],
  )

  const download = async () => {
    setState("loading")
    try {
      const res = await fetch(`/api/payslips/${payslipId}/pdf`)
      if (!res.ok) throw new Error(`PDF route answered ${res.status}`)
      const blob = await res.blob()
      const disposition = res.headers.get("content-disposition") ?? ""
      const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? fallbackName

      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = name
      document.body.appendChild(a)
      a.click()
      a.remove()
      // Give the browser a beat to start the save before the URL is revoked.
      setTimeout(() => URL.revokeObjectURL(url), 2000)

      setState("done")
      timer.current = setTimeout(() => setState("idle"), 1200)
    } catch (error) {
      console.error("[payslip-pdf] download failed:", error)
      toast.error("Could not prepare the payslip PDF.")
      setState("idle")
    }
  }

  return (
    <Button
      variant={state === "done" ? "success" : "outline"}
      loading={state === "loading"}
      loadingText="Preparing PDF…"
      onClick={download}
      aria-live="polite"
    >
      {state === "done" ? (
        <>
          <Check className="copy-check h-4 w-4" aria-hidden />
          Saved
        </>
      ) : (
        <>
          <Printer className="h-4 w-4" aria-hidden />
          Download PDF
        </>
      )}
    </Button>
  )
}
