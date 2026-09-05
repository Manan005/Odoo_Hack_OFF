import { WarningSeverity } from "@prisma/client"
import { db } from "@/lib/db"
import { fmtDate, fmtRange } from "@/lib/dates"

/**
 * Payroll warnings surfaced before finalization (PRD §M8.6).
 * BLOCKING ones stop VALIDATE; the rest inform but do not gate.
 */
export const WARNING_CODES = {
  NO_CONTRACT: "NO_CONTRACT",
  DUPLICATE_PAYSLIP: "DUPLICATE_PAYSLIP",
  MISSING_BANK_DETAILS: "MISSING_BANK_DETAILS",
  MISSING_EMAIL: "MISSING_EMAIL",
  NO_STRUCTURE: "NO_STRUCTURE",
  CONTRACT_EXPIRING: "CONTRACT_EXPIRING",
  ZERO_NET: "ZERO_NET",
} as const

export const WARNING_LABEL: Record<string, string> = {
  NO_CONTRACT: "No applicable contract",
  DUPLICATE_PAYSLIP: "Duplicate payslip",
  MISSING_BANK_DETAILS: "Missing bank details",
  MISSING_EMAIL: "Missing work email",
  NO_STRUCTURE: "Contract has no salary structure",
  CONTRACT_EXPIRING: "Contract expires this period",
  ZERO_NET: "Net salary is zero or negative",
}

interface Draft {
  code: string
  severity: WarningSeverity
  message: string
  payslipId: string | null
}

/**
 * Recompute the whole warning set for a payrun. Prior warnings are dropped
 * first so a resolved issue disappears rather than lingering.
 */
export async function regenerateWarnings(payrunId: string): Promise<{
  total: number
  blocking: number
}> {
  const payrun = await db.payrun.findUnique({
    where: { id: payrunId },
    select: {
      id: true,
      periodStart: true,
      periodEnd: true,
      payslips: {
        select: {
          id: true,
          net: true,
          contractId: true,
          employeeId: true,
          periodStart: true,
          periodEnd: true,
          employee: {
            select: {
              firstName: true,
              lastName: true,
              workEmail: true,
              bankAccountNumber: true,
            },
          },
          contract: {
            select: { reference: true, endDate: true, salaryStructureId: true },
          },
        },
      },
    },
  })
  if (!payrun) return { total: 0, blocking: 0 }

  const drafts: Draft[] = []

  // One query for every overlapping payslip elsewhere, rather than one per row.
  const employeeIds = payrun.payslips.map((p) => p.employeeId)
  const elsewhere = employeeIds.length
    ? await db.payslip.findMany({
        where: {
          employeeId: { in: employeeIds },
          payrunId: { not: payrunId },
          periodStart: { lte: payrun.periodEnd },
          periodEnd: { gte: payrun.periodStart },
        },
        select: {
          employeeId: true,
          periodStart: true,
          periodEnd: true,
          payrun: { select: { name: true } },
        },
      })
    : []
  const duplicatesByEmployee = new Map<string, (typeof elsewhere)[number]>()
  for (const d of elsewhere) {
    if (!duplicatesByEmployee.has(d.employeeId)) duplicatesByEmployee.set(d.employeeId, d)
  }

  for (const slip of payrun.payslips) {
    const who = `${slip.employee.firstName} ${slip.employee.lastName}`

    if (!slip.contractId) {
      drafts.push({
        code: WARNING_CODES.NO_CONTRACT,
        severity: WarningSeverity.BLOCKING,
        message: `No applicable contract for ${who} in ${fmtRange(payrun.periodStart, payrun.periodEnd)}.`,
        payslipId: slip.id,
      })
    } else if (!slip.contract?.salaryStructureId) {
      drafts.push({
        code: WARNING_CODES.NO_STRUCTURE,
        severity: WarningSeverity.BLOCKING,
        message: `Contract ${slip.contract?.reference ?? "—"} for ${who} has no salary structure.`,
        payslipId: slip.id,
      })
    }

    const duplicate = duplicatesByEmployee.get(slip.employeeId)
    if (duplicate) {
      drafts.push({
        code: WARNING_CODES.DUPLICATE_PAYSLIP,
        severity: WarningSeverity.BLOCKING,
        message: `${who} already has a payslip covering ${fmtRange(
          duplicate.periodStart,
          duplicate.periodEnd,
        )} in ${duplicate.payrun.name}.`,
        payslipId: slip.id,
      })
    }

    if (!slip.employee.bankAccountNumber) {
      drafts.push({
        code: WARNING_CODES.MISSING_BANK_DETAILS,
        severity: WarningSeverity.WARNING,
        message: `Missing bank details for ${who} — this payslip cannot be paid out.`,
        payslipId: slip.id,
      })
    }

    if (!slip.employee.workEmail) {
      drafts.push({
        code: WARNING_CODES.MISSING_EMAIL,
        severity: WarningSeverity.WARNING,
        message: `Cannot send a payslip to ${who} — no work email on file.`,
        payslipId: slip.id,
      })
    }

    if (
      slip.contract?.endDate &&
      slip.contract.endDate >= payrun.periodStart &&
      slip.contract.endDate <= payrun.periodEnd
    ) {
      drafts.push({
        code: WARNING_CODES.CONTRACT_EXPIRING,
        severity: WarningSeverity.INFO,
        message: `Contract ${slip.contract.reference} for ${who} expires on ${fmtDate(
          slip.contract.endDate,
        )}, inside this period.`,
        payslipId: slip.id,
      })
    }

    // Only meaningful once the slip has been computed at all.
    if (slip.contractId && Number(slip.net) <= 0) {
      drafts.push({
        code: WARNING_CODES.ZERO_NET,
        severity: WarningSeverity.WARNING,
        message: `Net salary is ${slip.net} for ${who} — check the rules and worked days.`,
        payslipId: slip.id,
      })
    }
  }

  await db.$transaction([
    db.payrollWarning.deleteMany({ where: { payrunId } }),
    ...(drafts.length > 0
      ? [
          db.payrollWarning.createMany({
            data: drafts.map((d) => ({ ...d, payrunId })),
          }),
        ]
      : []),
  ])

  return {
    total: drafts.length,
    blocking: drafts.filter((d) => d.severity === WarningSeverity.BLOCKING).length,
  }
}

/** VALIDATE is refused while any unresolved BLOCKING warning stands. */
export async function blockingWarnings(payrunId: string) {
  return db.payrollWarning.findMany({
    where: { payrunId, severity: WarningSeverity.BLOCKING, resolved: false },
    select: { id: true, code: true, message: true },
  })
}
