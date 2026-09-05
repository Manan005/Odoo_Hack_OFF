import nodemailer from "nodemailer"
import { db } from "@/lib/db"
import { fmtRange } from "@/lib/dates"
import { formatINR } from "@/lib/money"
import { renderPayslipPdf } from "@/lib/pdf/render-payslip"
import { PayrunError } from "@/lib/result"

export interface SendResult {
  sent: number
  skipped: Array<{ employee: string; reason: string }>
  failed: Array<{ employee: string; reason: string }>
}

const transporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    // MailHog speaks plain SMTP with no auth; a real host is a .env swap.
    secure: false,
    ignoreTLS: true,
  })

const body = (name: string, period: string, net: string, company: string) => ({
  text: [
    `Hello ${name},`,
    "",
    `Your payslip for ${period} is attached.`,
    `Net salary: ${net}`,
    "",
    "This is an automated message — please do not reply.",
    company,
  ].join("\n"),
  html: `
    <div style="font-family:system-ui,-apple-system,'Segoe UI',sans-serif;color:#1e293b;max-width:520px">
      <p>Hello ${name},</p>
      <p>Your payslip for <strong>${period}</strong> is attached.</p>
      <p style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:6px;padding:12px 16px;margin:16px 0">
        <span style="font-size:12px;color:#64748b;text-transform:uppercase;letter-spacing:.04em">Net salary</span><br>
        <strong style="font-size:20px;color:#4f46e5">${net}</strong>
      </p>
      <p style="font-size:12px;color:#64748b">
        This is an automated message — please do not reply.<br>${company}
      </p>
    </div>`,
})

/**
 * Bulk-send every payslip in a payrun. An employee without a work email is
 * skipped and reported rather than crashing the run (AC-M9-4).
 */
export async function sendPayrunPayslips(payrunId: string): Promise<SendResult> {
  const payrun = await db.payrun.findUnique({
    where: { id: payrunId },
    select: {
      id: true,
      name: true,
      status: true,
      periodStart: true,
      periodEnd: true,
      company: { select: { name: true } },
      payslips: {
        select: {
          id: true,
          net: true,
          employee: { select: { firstName: true, lastName: true, workEmail: true } },
        },
        orderBy: { employee: { firstName: "asc" } },
      },
    },
  })
  if (!payrun) throw new PayrunError("NOT_FOUND", "That payrun no longer exists.")
  if (payrun.payslips.length === 0) {
    throw new PayrunError("NO_ELIGIBLE_EMPLOYEES", "This payrun has no payslips to send.")
  }

  const period = fmtRange(payrun.periodStart, payrun.periodEnd)
  const mail = transporter()
  const result: SendResult = { sent: 0, skipped: [], failed: [] }
  const sentIds: string[] = []

  for (const slip of payrun.payslips) {
    const who = `${slip.employee.firstName} ${slip.employee.lastName}`

    if (!slip.employee.workEmail) {
      result.skipped.push({ employee: who, reason: "no work email on file" })
      continue
    }

    try {
      const pdf = await renderPayslipPdf(slip.id)
      if (!pdf) {
        result.failed.push({ employee: who, reason: "payslip could not be rendered" })
        continue
      }

      const content = body(
        slip.employee.firstName,
        `${payrun.name} (${period})`,
        formatINR(String(slip.net)),
        payrun.company.name,
      )

      await mail.sendMail({
        from: process.env.SMTP_FROM ?? "PeoplePay360 <payroll@oxp.com>",
        to: slip.employee.workEmail,
        subject: `Payslip — ${payrun.name}`,
        text: content.text,
        html: content.html,
        attachments: [
          { filename: pdf.filename, content: pdf.buffer, contentType: "application/pdf" },
        ],
      })

      sentIds.push(slip.id)
      result.sent++
    } catch (error) {
      console.error(`[sendPayrunPayslips] ${who}:`, error)
      result.failed.push({
        employee: who,
        reason: error instanceof Error ? error.message : "send failed",
      })
    }
  }

  const now = new Date()
  await db.$transaction([
    db.payslip.updateMany({ where: { id: { in: sentIds } }, data: { sentAt: now } }),
    db.payrun.update({ where: { id: payrunId }, data: { sentAt: now } }),
  ])

  return result
}
