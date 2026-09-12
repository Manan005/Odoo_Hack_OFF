"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import {
  ArrowRight,
  Calculator,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  Landmark,
  Lock,
  Mail,
  ShieldCheck,
  User,
  Users,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState, type CSSProperties } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { loginAction } from "@/actions/auth.actions"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/field"
import { loginSchema, type LoginInput } from "@/lib/validation/auth"
import { cn } from "@/lib/utils"

/** Seeded demo accounts (prisma/seed.ts). One click fills the form; a second signs in. */
const DEMO_ACCOUNTS = [
  { email: "admin@oxp.com", role: "Admin", icon: ShieldCheck },
  { email: "nisha@oxp.com", role: "HR Payroll Manager", icon: Landmark },
  { email: "rohan@oxp.com", role: "HR Payroll User", icon: Calculator },
  { email: "sara@oxp.com", role: "HR Manager", icon: Users },
  { email: "aarav@oxp.com", role: "Employee", icon: User },
] as const
const DEMO_PASSWORD = "demo1234"

/** 36px row + 2px gap. Rows are fixed height, so the pill needs no measuring. */
const ROW_PITCH = 38

const LEAVING_CLASS = "auth-leaving"

export function LoginForm({ next = "/" }: { next?: string }) {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [capsLock, setCapsLock] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [shaking, setShaking] = useState(false)

  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const currentEmail = watch("email")
  const selectedIndex = DEMO_ACCOUNTS.findIndex((a) => a.email === currentEmail)
  const selected = selectedIndex >= 0 ? DEMO_ACCOUNTS[selectedIndex] : null

  // The illustration is a Server Component in another subtree; a class on
  // <html> is the only channel that tells it we are leaving. Cleared if this
  // form ever unmounts without navigating.
  useEffect(() => () => document.documentElement.classList.remove(LEAVING_CLASS), [])

  const reject = (message: string) => {
    setFormError(message)
    setShaking(true)
    setFocus("password", { shouldSelect: true })
  }

  const onSubmit = handleSubmit(
    async (values) => {
      setFormError(null)
      let result: Awaited<ReturnType<typeof loginAction>>
      try {
        result = await loginAction(values)
      } catch (error) {
        console.error("[LoginForm] loginAction threw:", error)
        reject("Sign-in failed unexpectedly. Try again.")
        return
      }

      if (result.ok) {
        // Set here, in the handler, so the exit plays before the RSC
        // navigation swaps the page in. Full navigation so the new session
        // cookie reaches the server layout.
        setLeaving(true)
        document.documentElement.classList.add(LEAVING_CLASS)
        router.replace(next)
        router.refresh()
        return
      }

      if (result.fieldErrors) {
        for (const [field, message] of Object.entries(result.fieldErrors)) {
          setError(field as keyof LoginInput, { message })
        }
      }
      reject(result.message)
      // The inline alert already says it; a toast is for failures that are
      // not the form's own (rules.md §5).
      if (result.code !== "INVALID_CREDENTIALS" && result.code !== "VALIDATION") {
        toast.error(result.message)
      }
    },
    () => setShaking(true),
  )

  const fillDemo = (email: string) => {
    setValue("email", email, { shouldValidate: true })
    setValue("password", DEMO_PASSWORD, { shouldValidate: true })
    setFormError(null)
  }

  const busy = isSubmitting || leaving

  return (
    <div
      data-leaving={leaving || undefined}
      className={cn(
        "space-y-4 transition-[opacity,translate] duration-300 ease-out-quart",
        "data-leaving:pointer-events-none data-leaving:-translate-y-1 data-leaving:opacity-0",
      )}
    >
      <form
        onSubmit={onSubmit}
        noValidate
        className={cn("stagger space-y-3.5", shaking && "login-form-shake")}
        style={{ "--stagger-offset": 8 } as CSSProperties}
        onAnimationEnd={(e) => {
          if (e.animationName === "login-shake") setShaking(false)
        }}
      >
        <Field label="Work email" htmlFor="email" error={errors.email?.message} className="login-field">
          <div className="relative">
            <Input
              id="email"
              type="email"
              autoComplete="username"
              autoFocus
              placeholder="name@company.com"
              className="peer h-10 pl-10 text-[15px]"
              error={Boolean(errors.email)}
              {...register("email")}
            />
            <Mail
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground transition-colors duration-150 peer-focus:text-primary"
            />
          </div>
        </Field>

        <Field
          label="Password"
          htmlFor="password"
          error={errors.password?.message}
          hint={capsLock ? "Caps Lock is on" : undefined}
          className="login-field"
        >
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              className="peer h-10 pl-10 pr-12 text-[15px]"
              error={Boolean(errors.password)}
              {...register("password")}
              onKeyUp={(e) => setCapsLock(e.getModifierState("CapsLock"))}
            />
            <Lock
              aria-hidden
              className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle-foreground transition-colors duration-150 peer-focus:text-primary"
            />
            <button
              type="button"
              aria-label={showPassword ? "Hide password" : "Show password"}
              aria-pressed={showPassword}
              onClick={() => setShowPassword((v) => !v)}
              className={cn(
                "absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-subtle-foreground",
                "transition-colors duration-150 hover:bg-surface-hover hover:text-foreground",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
              )}
            >
              <Eye
                aria-hidden
                className={cn(
                  "h-4 w-4 transition-[rotate,scale,opacity] duration-300 ease-spring",
                  showPassword ? "rotate-90 scale-0 opacity-0" : "rotate-0 scale-100 opacity-100",
                )}
              />
              <EyeOff
                aria-hidden
                className={cn(
                  "absolute h-4 w-4 transition-[rotate,scale,opacity] duration-300 ease-spring",
                  showPassword ? "rotate-0 scale-100 opacity-100" : "-rotate-90 scale-0 opacity-0",
                )}
              />
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
          loading={isSubmitting && !leaving}
          loadingText="Signing in…"
          disabled={leaving}
        >
          {leaving ? (
            <>
              <Check className="h-4 w-4" aria-hidden />
              Signed in
            </>
          ) : (
            <>
              {/* Keyed on the account so the label pops when the selection changes. */}
              <span key={selected?.email ?? "none"} className="animate-scale-in">
                {selected ? `Sign in as ${selected.role}` : "Sign in"}
              </span>
              <ArrowRight
                className="h-4 w-4 transition-transform duration-200 ease-out-quart group-hover:translate-x-0.5"
                aria-hidden
              />
            </>
          )}
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
        <p className="mb-1.5 flex items-baseline justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-subtle-foreground">
          <span>Demo accounts</span>
          <span className="font-mono normal-case tracking-normal">password {DEMO_PASSWORD}</span>
        </p>

        <div className="relative">
          {/* One shared selection pill slides between rows. */}
          <span
            aria-hidden
            className="absolute inset-x-0 top-0 h-9 rounded-lg bg-primary-subtle/70 ring-1 ring-inset ring-primary/30 transition-[transform,opacity] duration-300 ease-out-quart"
            style={{
              transform: `translateY(${Math.max(selectedIndex, 0) * ROW_PITCH}px)`,
              opacity: selectedIndex < 0 ? 0 : 1,
            }}
          />
          <ul className="stagger relative space-y-0.5" style={{ "--stagger-offset": 12 } as CSSProperties}>
            {DEMO_ACCOUNTS.map((account) => {
              const active = account.email === currentEmail
              const Icon = account.icon
              return (
                <li key={account.email}>
                  <button
                    type="button"
                    aria-pressed={active}
                    disabled={busy}
                    onClick={() => (active ? void onSubmit() : fillDemo(account.email))}
                    className={cn(
                      "group flex h-9 w-full items-center gap-3 rounded-lg px-3 text-left",
                      "transition-colors duration-150 ease-out-quart",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-surface",
                      active ? "text-primary" : "text-foreground hover:bg-surface-hover",
                    )}
                  >
                    <span
                      className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition-colors duration-200 ease-out-quart",
                        active
                          ? "bg-primary text-primary-fg"
                          : "bg-surface-muted text-muted-foreground group-hover:text-foreground",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" aria-hidden />
                    </span>
                    <span className="shrink-0 text-xs font-medium">{account.role}</span>
                    <span className="ml-auto min-w-0 truncate font-mono text-[11px] text-muted-foreground">
                      {account.email}
                    </span>
                    <ChevronRight
                      aria-hidden
                      className={cn(
                        "h-4 w-4 shrink-0 transition-[translate,opacity] duration-200 ease-out-quart",
                        active
                          ? "translate-x-0 opacity-100"
                          : "-translate-x-1 opacity-0 group-hover:translate-x-0 group-hover:opacity-50",
                      )}
                    />
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
