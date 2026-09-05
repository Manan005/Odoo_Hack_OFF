import { Role } from "@prisma/client"
import { SimulatorPanel } from "@/components/payroll/SimulatorPanel"
import { EmptyState } from "@/components/shared/EmptyState"
import { Forbidden } from "@/components/shared/Forbidden"
import { PageHeader } from "@/components/shared/PageHeader"
import { pageAllows } from "@/lib/auth-guard"
import { loadSimulatorOptions, simulate, type SimulationResult } from "@/lib/payroll/simulator"

export const metadata = { title: "Salary Simulator — PeoplePay360" }

export default async function SimulatorPage() {
  const actor = await pageAllows(Role.HR_PAYROLL_USER)
  if (!actor) return <Forbidden message="The salary simulator is part of payroll." />

  const options = await loadSimulatorOptions(actor.companyId)

  if (options.periods.length === 0 || options.employees.length === 0) {
    return (
      <>
        <PageHeader title="Salary Simulator" />
        <EmptyState
          title="Nothing to simulate yet"
          description="The simulator compares against periods payroll has already run. Create and compute a payrun first."
        />
      </>
    )
  }

  // Compute the untouched baseline here rather than firing a round trip from a
  // mount effect: the page arrives with the comparison already on screen, and
  // an employee whose period has no contract simply starts blank.
  const { defaults } = options
  const [start, end] = defaults.period.split("|")

  let initial: SimulationResult | null = null
  if (defaults.employeeId && defaults.structureId && start && end) {
    try {
      initial = await simulate({
        employeeId: defaults.employeeId,
        structureId: defaults.structureId,
        periodStart: new Date(start),
        periodEnd: new Date(end),
        wage: null,
        workedDays: null,
        overtimeHours: null,
        unpaidLeaveDays: null,
      })
    } catch {
      // No contract for that period, or a structure with no rules — the panel
      // renders its controls and the user picks something that does compute.
      initial = null
    }
  }

  return (
    <>
      <PageHeader
        title="Salary Simulator"
        subtitle="Model a change before you commit to it — same engine as a real payrun, but nothing is saved."
      />
      <SimulatorPanel options={options} defaults={defaults} initial={initial} />
    </>
  )
}
