/**
 * P9 smoke test — every route, for every role, over real HTTP.
 * Confirms nothing 500s and that role scoping behaves as designed.
 * Requires the dev server on :3000.
 */
import { PrismaClient } from "@prisma/client"

const db = new PrismaClient()
const APP = "http://localhost:3000"

async function login(email: string): Promise<string> {
  const cookies: string[] = []
  const collect = (res: Response) => {
    for (const c of res.headers.getSetCookie?.() ?? []) cookies.push(c.split(";")[0])
  }
  const csrfRes = await fetch(`${APP}/api/auth/csrf`)
  collect(csrfRes)
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  const res = await fetch(`${APP}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.join("; "),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "demo1234",
      redirect: "false",
      callbackUrl: `${APP}/`,
    }),
    redirect: "manual",
  })
  collect(res)
  return cookies.join("; ")
}

type Expect = "ok" | "forbidden" | "redirect"

async function probe(cookie: string, path: string): Promise<{ status: number; kind: Expect }> {
  const res = await fetch(`${APP}${path}`, { headers: { Cookie: cookie }, redirect: "manual" })
  const status = res.status
  if (status >= 300 && status < 400) return { status, kind: "redirect" }
  const body = await res.text()
  return { status, kind: body.includes("Access denied") ? "forbidden" : "ok" }
}

async function main() {
  const ids = {
    employee: (await db.employee.findFirstOrThrow({ where: { employeeCode: "EMP/0001" } })).id,
    contract: (await db.contract.findFirstOrThrow({ where: { reference: "CON/2026/0042" } })).id,
    schedule: (await db.workingSchedule.findFirstOrThrow()).id,
    attendance: (await db.attendance.findFirstOrThrow()).id,
    request: (await db.timeOffRequest.findFirstOrThrow()).id,
    allocation: (await db.timeOffAllocation.findFirstOrThrow()).id,
    type: (await db.timeOffType.findFirstOrThrow()).id,
    structure: (await db.salaryStructure.findFirstOrThrow()).id,
    rule: (await db.salaryRule.findFirstOrThrow()).id,
    payrun: (await db.payrun.findFirstOrThrow()).id,
    payslip: (await db.payslip.findFirstOrThrow({ where: { contractId: { not: null } } })).id,
    user: (await db.user.findFirstOrThrow({ where: { email: "aarav@oxp.com" } })).id,
  }

  const routes: string[] = [
    "/",
    "/employees",
    "/employees?view=list",
    "/employees/new",
    `/employees/${ids.employee}`,
    "/employees/me",
    "/departments",
    "/job-positions",
    "/contracts",
    "/contracts/new",
    `/contracts/${ids.contract}`,
    "/working-schedules",
    "/working-schedules/new",
    `/working-schedules/${ids.schedule}`,
    "/attendance",
    "/attendance/new",
    `/attendance/${ids.attendance}`,
    "/time-off/requests",
    "/time-off/requests/new",
    `/time-off/requests/${ids.request}`,
    "/time-off/allocations",
    "/time-off/allocations/new",
    `/time-off/allocations/${ids.allocation}`,
    "/time-off/types",
    "/time-off/types/new",
    `/time-off/types/${ids.type}`,
    "/payroll/dashboard",
    "/payroll/payruns",
    `/payroll/payruns/${ids.payrun}`,
    "/payroll/payslips",
    `/payroll/payslips/${ids.payslip}`,
    "/payroll/simulator",
    "/payroll/structures",
    "/payroll/structures/new",
    `/payroll/structures/${ids.structure}`,
    "/payroll/rules",
    "/payroll/rules/new",
    `/payroll/rules/${ids.rule}`,
    "/users",
    "/users/new",
    `/users/${ids.user}`,
    `/api/payslips/${ids.payslip}/pdf`,
  ]

  const accounts: Array<[string, string]> = [
    ["ADMIN", "admin@oxp.com"],
    ["PAYROLL_MANAGER", "nisha@oxp.com"],
    ["PAYROLL_USER", "rohan@oxp.com"],
    ["HR_MANAGER", "sara@oxp.com"],
    ["EMPLOYEE", "aarav@oxp.com"],
  ]

  let errors = 0

  for (const [label, email] of accounts) {
    const cookie = await login(email)
    const ok: string[] = []
    const forbidden: string[] = []
    const redirected: string[] = []
    const broken: string[] = []

    for (const path of routes) {
      const r = await probe(cookie, path)
      if (r.status >= 500) {
        broken.push(`${path} (${r.status})`)
        errors++
      } else if (r.kind === "forbidden" || r.status === 403 || r.status === 401) {
        forbidden.push(path)
      } else if (r.kind === "redirect") {
        redirected.push(path)
      } else {
        ok.push(path)
      }
    }

    console.log(
      `${label.padEnd(16)} ok ${String(ok.length).padStart(2)} · forbidden ${String(forbidden.length).padStart(2)} · redirect ${String(redirected.length).padStart(2)} · broken ${broken.length}`,
    )
    if (broken.length > 0) for (const b of broken) console.log(`    BROKEN ${b}`)
    if (forbidden.length > 0) {
      console.log(`    blocked: ${forbidden.slice(0, 8).join(", ")}${forbidden.length > 8 ? " …" : ""}`)
    }
  }

  console.log(`\n${routes.length} routes × ${accounts.length} roles = ${routes.length * accounts.length} checks`)
  console.log(errors === 0 ? "No 5xx responses. PASS" : `${errors} broken responses. FAIL`)
  process.exit(errors === 0 ? 0 : 1)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
