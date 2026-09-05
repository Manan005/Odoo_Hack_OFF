"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ArrowRight, Eye, EyeOff } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { loginAction } from "@/actions/auth.actions"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/field"
import { loginSchema, type LoginInput } from "@/lib/validation/auth"
import { cn } from "@/lib/utils"

/** Seeded demo accounts (prisma/seed.ts). One click fills the form. */
const DEMO_ACCOUNTS = [
  { email: "admin@oxp.com", role: "Admin" },
  { email: "nisha@oxp.com", role: "HR Payroll Manager" },
  { email: "rohan@oxp.com", role: "HR Payroll User" },
  { email: "sara@oxp.com", role: "HR Manager" },
  { email: "aarav@oxp.com", role: "Employee" },
] as const
const DEMO_PASSWORD = "demo1234"

export function LoginForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const currentEmail = watch("email")

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await loginAction(values)

    if (result.ok) {
      // Full navigation so the new session cookie reaches the server layout.
      router.replace("/")
      router.refresh()
      return
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof LoginInput, { message })
      }
    }
    setFormError(result.message)
    toast.error(result.message)
  })

  const fillDemo = (email: string) => {
    setValue("email", email, { shouldValidate: true })
    setValue("password", DEMO_PASSWORD, { shouldValidate: true })
    setFormError(null)
  }

  return (
    <div className="space-y-6">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Work Email" htmlFor="email" error={errors.email?.message}>
          <Input
            id="email"
            type="email"
            autoComplete="username"
            placeholder="name@company.com"
            error={Boolean(errors.email)}
            {...register("email")}
          />
        </Field>

        <Field label="Password" htmlFor="password" error={errors.password?.message}>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="pr-10"
              error={Boolean(errors.password)}
              {...register("password")}
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-subtle-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" aria-hidden />
              ) : (
                <Eye className="h-4 w-4" aria-hidden />
              )}
            </button>
          </div>
        </Field>

        {formError && (
          <p
            role="alert"
            className="animate-scale-in rounded-lg bg-danger-subtle px-3 py-2 text-xs text-danger ring-1 ring-inset ring-danger/20"
          >
            {formError}
          </p>
        )}

        <Button
          type="submit"
          size="lg"
          className="group w-full"
          loading={isSubmitting}
          loadingText="Signing in…"
        >
          Sign in
          <ArrowRight
            className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5"
            aria-hidden
          />
        </Button>

        <button
          type="button"
          className="w-full text-center text-xs text-muted-foreground transition-colors hover:text-primary"
          onClick={() => toast.info("Contact your administrator to reset your password.")}
        >
          Forgot password?
        </button>
      </form>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
          Demo accounts · password {DEMO_PASSWORD}
        </p>
        <div className="stagger grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((a) => {
            const active = currentEmail === a.email
            return (
              <button
                key={a.email}
                type="button"
                onClick={() => fillDemo(a.email)}
                aria-pressed={active}
                className={cn(
                  "group flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left",
                  "transition-[background-color,border-color,transform,box-shadow] duration-150 ease-out-quart",
                  "hover:-translate-y-px hover:shadow-card active:translate-y-0",
                  active
                    ? "border-primary/40 bg-primary-subtle/60"
                    : "border-border/70 bg-surface hover:border-border-strong",
                )}
              >
                <span className="min-w-0">
                  <span
                    className={cn(
                      "block text-xs font-medium",
                      active ? "text-primary" : "text-foreground",
                    )}
                  >
                    {a.role}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {a.email}
                  </span>
                </span>
                <ArrowRight
                  className={cn(
                    "h-3.5 w-3.5 shrink-0 text-subtle-foreground transition-[transform,opacity] duration-150",
                    active
                      ? "translate-x-0 text-primary opacity-100"
                      : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                  )}
                  aria-hidden
                />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
