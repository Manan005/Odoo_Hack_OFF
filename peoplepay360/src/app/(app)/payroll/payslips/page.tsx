import { ComingInPhase } from "@/components/shared/ComingInPhase"

export const metadata = { title: "Payslips — PeoplePay360" }

// P6 replaces this stub; PDF and email delivery land in P7.
export default function PayslipsPage() {
  return (
    <ComingInPhase
      title="Payslips"
      phase="P6"
      hours="13–17"
      description="Per-employee salary computation showing every rule line — Basic, Allowances, Gross, Deductions and Net — traced to the contract and structure it used."
      buildsOn={["P6 the computation engine", "P7 PDF generation and bulk email"]}
    />
  )
}
