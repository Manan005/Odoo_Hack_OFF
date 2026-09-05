import { ComingInPhase } from "@/components/shared/ComingInPhase"

export const metadata = { title: "Attendance — PeoplePay360" }

// P4 replaces this stub.
export default function AttendancePage() {
  return (
    <ComingInPhase
      title="Attendance"
      phase="P4"
      hours="8–10"
      description="Check in / check out with derived worked hours and overtime, exception handling for late and absent days, and HR-only manual corrections with an audit trail."
      buildsOn={["P2 Working Schedules — expected hours per weekday"]}
    />
  )
}
