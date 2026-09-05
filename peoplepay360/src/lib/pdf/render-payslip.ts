import { createElement, type ReactElement } from "react"
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer"
import { db } from "@/lib/db"
import { fmtRange } from "@/lib/dates"
import { registerPdfFonts } from "@/lib/pdf/fonts"
import { PayslipDocument, toPdfData } from "@/lib/pdf/payslip-document"

/** Loads a payslip and renders it to a PDF buffer. Shared by the route and the mailer. */
export async function renderPayslipPdf(payslipId: string): Promise<{
  buffer: Buffer
  filename: string
  employeeName: string
  workEmail: string | null
} | null> {
  registerPdfFonts()

  const payslip = await db.payslip.findUnique({
    where: { id: payslipId },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeCode: true,
          workEmail: true,
          bankAccountNumber: true,
          department: { select: { name: true } },
          jobPosition: { select: { name: true } },
          company: { select: { name: true, address: true } },
        },
      },
      contract: { select: { reference: true, wage: true } },
      payrun: { select: { name: true, structure: { select: { name: true } } } },
      lines: { orderBy: { sequence: "asc" } },
    },
  })
  if (!payslip) return null

  const data = toPdfData({
    ...payslip,
    periodLabel: fmtRange(payslip.periodStart, payslip.periodEnd),
    company: payslip.employee.company,
  })

  // PayslipDocument renders a <Document> at its root; the cast tells
  // renderToBuffer that, since it cannot see through the wrapper component.
  const element = createElement(PayslipDocument, { data }) as unknown as ReactElement<DocumentProps>
  const buffer = await renderToBuffer(element)

  return {
    buffer: Buffer.from(buffer),
    filename: `${payslip.reference.replace(/\//g, "-")}-${payslip.employee.lastName}.pdf`,
    employeeName: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
    workEmail: payslip.employee.workEmail,
  }
}
