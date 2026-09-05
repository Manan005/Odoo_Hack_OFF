"use server"

import { Role } from "@prisma/client"
import { requireRole } from "@/lib/auth-guard"
import { simulate, type SimulationResult } from "@/lib/payroll/simulator"
import { ok, toActionResult, type ActionResult } from "@/lib/result"
import { simulationSchema } from "@/lib/validation/simulator"

export type { SimulationResult }

/**
 * Guard, validate, delegate — no business logic here (rules.md §2.1).
 *
 * Read-only by construction: there is no `revalidatePath` because nothing
 * changed, and `simulate()` never writes.
 */
export async function runSimulation(raw: unknown): Promise<ActionResult<SimulationResult>> {
  try {
    await requireRole(Role.HR_PAYROLL_USER)
    const input = simulationSchema.parse(raw)
    return ok(await simulate(input))
  } catch (error) {
    return toActionResult(error, "runSimulation")
  }
}
