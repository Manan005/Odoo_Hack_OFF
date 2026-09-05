import { NextResponse } from "next/server"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { renderPayslipPdf } from "@/lib/pdf/render-payslip"

/**
 * One of only two Route Handlers in the app — it streams a binary response,
 * which a Server Action cannot do (rules.md §2.2).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const viewer = await pageUser()
  if (!viewer) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 })
  }

  const { id } = await params

  const slip = await db.payslip.findUnique({
    where: { id },
    select: { employeeId: true },
  })
  if (!slip) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // An employee may print their own payslip; anything else needs payroll rank.
  const isPayroll = rankOf(viewer.roles) >= ROLE_RANK.HR_PAYROLL_USER
  if (!isPayroll && slip.employeeId !== viewer.employeeId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  const rendered = await renderPayslipPdf(id)
  if (!rendered) return NextResponse.json({ error: "Not found" }, { status: 404 })

  return new NextResponse(new Uint8Array(rendered.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${rendered.filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
