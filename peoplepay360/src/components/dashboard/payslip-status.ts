/**
 * Payslip status → fill class for the segmented bar on the Payslips card.
 * Tones mirror StatusBadge so the bar and the badges agree everywhere.
 * Server-safe: no directive, so Server Components can read it directly.
 */
export const PAYSLIP_STATUS_ORDER = ["PAID", "VALIDATED", "COMPUTED", "DRAFT"] as const

export const PAYSLIP_STATUS_FILL: Record<string, string> = {
  PAID: "bg-success",
  VALIDATED: "bg-primary",
  COMPUTED: "bg-info",
  DRAFT: "bg-neutral",
}

export const PAYSLIP_STATUS_LABEL: Record<string, string> = {
  PAID: "paid",
  VALIDATED: "validated",
  COMPUTED: "computed",
  DRAFT: "draft",
}
