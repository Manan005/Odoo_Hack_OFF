import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginForm } from "@/components/auth/LoginForm"
import { Logo, LogoMark } from "@/components/layout/Logo"
import { ThemeToggle } from "@/components/theme/ThemeToggle"

export const metadata = { title: "Sign in — PeoplePay360" }

const PILLARS = [
  ["Employees", "bg-chart-1"],
  ["Contracts", "bg-chart-2"],
  ["Attendance", "bg-chart-3"],
  ["Time off", "bg-chart-4"],
  ["Payroll", "bg-chart-5"],
] as const

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect("/")

  return (
    <main className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel — ink in both themes. */}
      <section className="relative hidden overflow-hidden bg-ink p-12 text-ink-fg lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="pointer-events-none absolute inset-0">
          <span className="absolute -left-24 top-1/4 h-[420px] w-[420px] animate-float rounded-full bg-chart-1/60 blur-3xl" />
          <span className="absolute right-[-10%] top-[-10%] h-[380px] w-[380px] animate-float rounded-full bg-chart-4/40 blur-3xl [animation-delay:-4s]" />
          <span className="absolute bottom-[-20%] left-1/3 h-[360px] w-[360px] animate-float rounded-full bg-chart-2/35 blur-3xl [animation-delay:-7s]" />
        </div>

        <div className="relative flex items-center gap-2.5">
          <LogoMark inverted className="[&>span]:opacity-100" />
          <span className="text-[15px] font-semibold tracking-tight">
            PeoplePay<span className="text-chart-1">360</span>
          </span>
        </div>

        <div className="relative max-w-md">
          <h1 className="animate-fade-up text-[44px] font-semibold leading-[1.05] tracking-[-0.03em]">
            Payroll that shows its working.
          </h1>
          <p className="mt-5 max-w-sm animate-fade-up text-[15px] leading-relaxed text-ink-fg/70 [animation-delay:120ms]">
            Every payslip line traces to a salary rule. Every dashboard figure is a live query.
            Nothing on screen is typed in by hand.
          </p>
        </div>

        <ul className="stagger relative flex flex-wrap gap-2">
          {PILLARS.map(([label, dot]) => (
            <li
              key={label}
              className="inline-flex items-center gap-2 rounded-full border border-ink-fg/15 bg-ink-fg/5 px-3 py-1.5 text-xs font-medium text-ink-fg/85 backdrop-blur"
            >
              <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${dot}`} />
              {label}
            </li>
          ))}
        </ul>
      </section>

      {/* Form panel */}
      <section className="relative flex items-center justify-center px-6 py-12">
        <div aria-hidden className="ambient-glow pointer-events-none absolute inset-x-0 top-0 h-80" />
        <div className="absolute right-5 top-5">
          <ThemeToggle />
        </div>

        <div className="stagger relative w-full max-w-sm">
          <div className="mb-8 flex items-center justify-between lg:hidden">
            <Logo href="/login" />
          </div>

          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-primary">
              Sign in
            </p>
            <h2 className="mt-1.5 text-[28px] font-semibold tracking-[-0.02em]">Welcome back</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Sign in to continue to your workspace.
            </p>
          </div>

          <div className="mt-7">
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  )
}
