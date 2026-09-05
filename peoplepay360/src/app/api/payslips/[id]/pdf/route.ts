import { NextResponse } from "next/server"
import { ROLE_RANK, pageUser, rankOf } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { renderPayslipPdf } from "@/lib/pdf/render-payslip"

/**
 * One of only two Route Handlers in the app — it streams a binary response,
 * which a Server Action cannot do (rules.md §2.2).
 */
export async function GET(
  request: Request,
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

  // Rendering touches the filesystem for fonts and can fail for reasons the
  // caller cannot act on; without this the failure surfaces as a bare 500 with
  // an empty body, which is what a missing font file looked like.
  let rendered: Awaited<ReturnType<typeof renderPayslipPdf>>
  try {
    rendered = await renderPayslipPdf(id)
  } catch (error) {
    console.error(`[payslip-pdf] render failed for ${id}:`, error)
    return NextResponse.json(
      { error: "Could not render the payslip PDF.", detail: String(error) },
      { status: 500 },
    )
  }
  if (!rendered) return NextResponse.json({ error: "Not found" }, { status: 404 })

  // `?view=1` previews in the browser's PDF viewer; the default is a download,
  // because a payslip is a document you keep, not a page you visit.
  const inline = new URL(request.url).searchParams.get("view") === "1"

  return new NextResponse(new Uint8Array(rendered.buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${rendered.filename}"`,
      "Cache-Control": "no-store",
    },
  })
}
