"use client"

import { Toaster } from "sonner"
import { useTheme } from "@/components/theme/ThemeProvider"

export function ThemedToaster() {
  const { resolved } = useTheme()
  return (
    <Toaster
      position="top-right"
      theme={resolved}
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl! border-border/70! shadow-modal! font-sans!",
        },
      }}
    />
  )
}
