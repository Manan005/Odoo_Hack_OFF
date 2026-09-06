import type { CSSProperties } from "react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LedgerIllustration } from "@/components/auth/LedgerIllustration"
import { LoginForm } from "@/components/auth/LoginForm"
import { Logo, LogoMark } from "@/components/layout/Logo"
import { Spotlight } from "@/components/motion/Spotlight"
import { ThemeToggle } from "@/components/theme/ThemeToggle"

export const metadata = { title: "Sign in — PeoplePay360" }

/**
 * Auth.js appends `?callbackUrl=` when it bounces a deep link here. Only a
 * same-origin path may be honoured (open-redirect guard, rules.md §4), and
 * never /login itself, which would loop.
 */
function safeNext(raw: string | string[] | undefined): string {
  const value = Array.isArray(raw) ? raw[0] : raw
  if (!value || !value.startsWith("/")) return "/"
  if (value.startsWith("//") || value.startsWith("/\\") || value.startsWith("/login")) return "/"
  return value
}

const delay = (ms: number) => ({ "--lt": `${ms}ms` }) as CSSProperties

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [session, params] = await Promise.all([auth(), searchParams])
  const next = safeNext(params.callbackUrl)
  if (session?.user) redirect(next)

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.15fr_0.85fr]">
      {/*
       * Brand panel — ink in both themes. `scheme-dark` makes every
       * light-dark() token inside resolve to its ink-side value, so the
       * pastel chart colours read on ink whatever the page theme is.
       */}
      {/* minmax(0,1fr) lets the middle row shrink below the SVG's intrinsic height on 768px laptops. */}
      <section className="scheme-dark relative hidden overflow-hidden bg-ink p-12 text-ink-fg lg:grid lg:grid-rows-[auto_minmax(0,1fr)_auto] lg:gap-10 lg:border-r lg:border-ink-fg/8">
        <div aria-hidden className="login-ruled pointer-events-none absolute inset-0" />

        <div className="group relative flex items-center gap-2.5">
          {/* The mark keeps the paper-side stripe colours: pastel on its white tile would wash out. */}
          <LogoMark inverted className="login-mark scheme-light" />
          <span className="text-[15px] font-semibold tracking-tight">
            PeoplePay<span className="text-primary">360</span>
          </span>
        </div>

        <Spotlight className="relative flex h-full min-h-0 items-center justify-center rounded-3xl">
          <div aria-hidden className="login-glow pointer-events-none absolute inset-0" />
          <LedgerIllustration className="relative h-auto max-h-full w-full max-w-[640px]" />
        </Spotlight>

        <div className="relative max-w-md">
          <p className="font-display text-[44px] font-medium leading-[1.04] tracking-[-0.02em] xl:text-[52px]">
            <span className="login-line">
              <span style={delay(120)}>Payroll that shows</span>
            </span>
            <span className="login-line">
              <span style={delay(240)}>
                its{" "}
                <em className="relative inline-block italic text-chart-1">
                  working.
                  <svg aria-hidden viewBox="0 0 200 12" preserveAspectRatio="none" className="login-underline">
                    <path
                      d="M2 8 C48 3 118 12 198 5"
                      pathLength={1}
                      fill="none"
                      strokeWidth={2.5}
                      strokeLinecap="round"
                      className="stroke-chart-3"
                      style={delay(1200)}
                    />
                  </svg>
                </em>
              </span>
            </span>
          </p>
          <p className="mt-5 max-w-sm animate-fade-up text-pretty text-[15px] leading-relaxed text-ink-fg/70 [animation-delay:560ms]">
            Every payslip line traces to a salary rule. Every dashboard figure is a live query.
            Nothing on screen is typed in by hand.
          </p>
        </div>
      </section>

      {/* Form panel */}
      <section className="relative flex items-center justify-center px-6 py-12 sm:px-10">
        <div aria-hidden className="ambient-glow pointer-events-none absolute inset-x-0 top-0 h-80" />

        <div
          className="stagger relative w-full max-w-[440px] lg:rounded-3xl lg:bg-surface lg:p-9 lg:shadow-raise"
          style={{ "--stagger-offset": 6 } as CSSProperties}
        >
          <div className="mb-8 lg:hidden">
            <Logo href="/login" />
          </div>

          <div>
            <h1 className="text-[28px] font-semibold tracking-[-0.02em]">Welcome back</h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Use your work email, or pick a demo account below.
            </p>
          </div>

          <div className="mt-7">
            <LoginForm next={next} />
          </div>
        </div>

        {/* After the form in DOM so the first Tab lands in the email field. */}
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>
      </section>
    </main>
  )
}
