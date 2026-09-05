import { Banknote } from "lucide-react"
import { redirect } from "next/navigation"
import { auth } from "@/auth"
import { LoginForm } from "@/components/auth/LoginForm"

export const metadata = { title: "Sign in — PeoplePay360" }

export default async function LoginPage() {
  const session = await auth()
  if (session?.user) redirect("/")

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center justify-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-fg">
            <Banknote className="h-5 w-5" />
          </span>
          <span className="text-lg font-semibold tracking-tight">HR Portal</span>
        </div>

        <div className="rounded-lg border border-border bg-surface p-6 shadow-card">
          <h1 className="text-xl font-semibold tracking-tight">Welcome back</h1>
          <p className="mb-5 mt-1 text-sm text-muted-foreground">
            Sign in to continue to your workspace.
          </p>
          <LoginForm />
        </div>

        <div className="mt-4 rounded-lg border border-border bg-surface-muted p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            Demo accounts · password demo1234
          </p>
          <ul className="space-y-0.5 text-[11px] text-muted-foreground">
            <li>
              <span className="font-mono">admin@oxp.com</span> — Admin
            </li>
            <li>
              <span className="font-mono">nisha@oxp.com</span> — HR Payroll Manager
            </li>
            <li>
              <span className="font-mono">rohan@oxp.com</span> — HR Payroll User
            </li>
            <li>
              <span className="font-mono">sara@oxp.com</span> — HR Manager
            </li>
            <li>
              <span className="font-mono">aarav@oxp.com</span> — Employee
            </li>
          </ul>
        </div>
      </div>
    </main>
  )
}
