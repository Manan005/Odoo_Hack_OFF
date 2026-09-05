import { ComingInPhase } from "@/components/shared/ComingInPhase"

export const metadata = { title: "Time Off Requests — PeoplePay360" }

// P5 replaces this stub.
export default function TimeOffRequestsPage() {
  return (
    <ComingInPhase
      title="Time Off Requests"
      phase="P5"
      hours="10–13"
      description="Leave requests with a simple approve/refuse workflow. Approving a request consumes the linked allocation balance; refusing it releases the days back."
      buildsOn={[
        "P5 Time Off Types — whether a type requires an allocation",
        "P5 Allocations — the balance a request draws from",
      ]}
    />
  )
}
