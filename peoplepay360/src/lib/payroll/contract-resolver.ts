import { ContractStatus, Prisma } from "@prisma/client"
import { db } from "@/lib/db"

/**
 * BR-C2 — the contract in force during the payroll period.
 *
 * NOT `orderBy: { createdAt: "desc" }`, and NOT "the active one". A contract
 * applies when its range intersects the period:
 *
 *     startDate <= periodEnd  AND  (endDate IS NULL OR endDate >= periodStart)
 *
 * Aarav has CON/2025/0018 (Jul–Dec 2025, ₹78,000) and CON/2026/0042
 * (Jan 2026 –, ₹85,000). A November 2025 payrun must resolve the former.
 */
export async function resolveContract(
  employeeId: string,
  periodStart: Date,
  periodEnd: Date,
  client: Prisma.TransactionClient | typeof db = db,
) {
  return client.contract.findFirst({
    where: {
      employeeId,
      status: ContractStatus.RUNNING,
      startDate: { lte: periodEnd },
      OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
    },
    // Tie-break only — BR-C1 prevents genuine overlaps on write.
    orderBy: { startDate: "desc" },
    include: { salaryStructure: true, workingSchedule: { include: { lines: true } } },
  })
}

export type ResolvedContract = Awaited<ReturnType<typeof resolveContract>>

/**
 * BR-C1 — an employee may not hold two RUNNING contracts whose ranges overlap.
 * Returns the conflicting contract so the caller can name it in the error.
 *
 * A null endDate means open-ended, i.e. it extends to infinity, so it collides
 * with anything starting on or after its startDate.
 */
export async function findOverlappingRunningContract(
  employeeId: string,
  startDate: Date,
  endDate: Date | null,
  excludeContractId?: string,
) {
  return db.contract.findFirst({
    where: {
      employeeId,
      status: ContractStatus.RUNNING,
      ...(excludeContractId ? { id: { not: excludeContractId } } : {}),
      // Existing starts before this one ends (or this one is open-ended)…
      ...(endDate ? { startDate: { lte: endDate } } : {}),
      // …and existing ends after this one starts (or existing is open-ended).
      OR: [{ endDate: null }, { endDate: { gte: startDate } }],
    },
    select: { id: true, reference: true, startDate: true, endDate: true },
    orderBy: { startDate: "asc" },
  })
}

/**
 * BR-C4 — a RUNNING contract whose endDate has passed reads as Expired.
 * Computed at read time; no background job needed.
 */
export function displayStatus(contract: {
  status: ContractStatus
  endDate: Date | null
}): ContractStatus {
  if (
    contract.status === ContractStatus.RUNNING &&
    contract.endDate !== null &&
    contract.endDate < new Date()
  ) {
    return ContractStatus.EXPIRED
  }
  return contract.status
}
