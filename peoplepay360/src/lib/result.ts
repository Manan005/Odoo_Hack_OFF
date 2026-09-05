/**
 * Server Actions never throw across the boundary — they return ActionResult.
 * Domain errors below carry a code the UI can key on. See rules.md §5.
 */

export type FieldErrors = Record<string, string>

export type ActionResult<T = void> =
  | { ok: true; data: T }
  | { ok: false; code: string; message: string; fieldErrors?: FieldErrors }

export const ok = <T>(data: T): ActionResult<T> => ({ ok: true, data })

export const fail = (
  code: string,
  message: string,
  fieldErrors?: FieldErrors,
): ActionResult<never> => ({ ok: false, code, message, fieldErrors })

// ─────────────────────────── Domain errors ───────────────────────────

export class DomainError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message)
    this.name = new.target.name
  }
}

export class ContractError extends DomainError {}
export class TimeOffError extends DomainError {}
export class SalaryRuleError extends DomainError {}
export class PayrunError extends DomainError {}
export class AuthError extends DomainError {}

/**
 * The single catch site for every Server Action. Logs with context, then maps
 * to a typed failure — never swallows (rules.md §5: no silent catches).
 */
export function toActionResult(error: unknown, context: string): ActionResult<never> {
  if (error instanceof DomainError) {
    console.error(`[${context}] ${error.code}: ${error.message}`)
    return fail(error.code, error.message, error.fieldErrors)
  }

  console.error(`[${context}] unexpected error:`, error)
  const message = error instanceof Error ? error.message : String(error)
  return fail("INTERNAL_ERROR", message)
}
