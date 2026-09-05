/**
 * Blank starting values for every create form.
 *
 * These live here, in a plain module, and NOT beside their form components —
 * because those components are `"use client"`. When a Server Component imports
 * a *value* from a client module it does not receive the value: it receives a
 * client-reference stub that React resolves later, on the client. Passing that
 * stub straight through as a prop happens to work, but reading or spreading it
 * on the server silently yields `undefined` for every field:
 *
 *   initial={{ ...emptyAttendance, employeeId }}   // ← every other key: undefined
 *
 * which renders inputs with no `value`, so React mounts them uncontrolled and
 * warns the moment the user types. Keeping the defaults server-safe removes the
 * whole class of bug. The *types* below are `import type` only, so nothing
 * crosses the boundary at runtime.
 */
import {
  ApprovalMode,
  AttendanceStatus,
  CalendarType,
  ComputationType,
  ContractStatus,
  EmployeeType,
  PercentageBase,
  RuleCategory,
  TimeOffUnit,
  Weekday,
} from "@prisma/client"
import type { AttendanceFormValues } from "@/components/attendance/AttendanceForm"
import type { ContractFormValues } from "@/components/contracts/ContractForm"
import type { EmployeeFormValues } from "@/components/employees/EmployeeForm"
import type { RuleFormValues } from "@/components/payroll/SalaryRuleForm"
import type { ScheduleFormValues } from "@/components/schedules/WeeklyPatternGrid"
import type { AllocationFormValues } from "@/components/timeoff/AllocationForm"
import type { RequestFormValues } from "@/components/timeoff/RequestForm"
import type { TypeFormValues } from "@/components/timeoff/TypeForm"

export const emptyEmployee: EmployeeFormValues = {
  firstName: "",
  lastName: "",
  workEmail: "",
  workPhone: "",
  employeeType: EmployeeType.FULL_TIME,
  workLocation: "",
  departmentId: "",
  jobPositionId: "",
  managerId: "",
  workingScheduleId: "",
  active: true,
  personalEmail: "",
  personalPhone: "",
  dateOfBirth: "",
  gender: "",
  address: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  bankAccountNumber: "",
  bankName: "",
  bankIfsc: "",
  joiningDate: "",
}

export const emptyContract: ContractFormValues = {
  employeeId: "",
  startDate: "",
  endDate: "",
  wage: "",
  status: ContractStatus.DRAFT,
  departmentId: "",
  jobPositionId: "",
  workingScheduleId: "",
  salaryStructureId: "",
  notes: "",
}

export const emptySchedule: ScheduleFormValues = {
  name: "",
  calendarType: CalendarType.FIXED,
  timezone: "Asia/Kolkata",
  active: true,
  lines: [
    Weekday.MONDAY,
    Weekday.TUESDAY,
    Weekday.WEDNESDAY,
    Weekday.THURSDAY,
    Weekday.FRIDAY,
  ].map((day) => ({ day, startTime: "09:00", endTime: "18:00", breakHours: 1 })),
}

export const emptyAttendance: AttendanceFormValues = {
  employeeId: "",
  checkIn: "",
  checkOut: "",
  status: AttendanceStatus.PRESENT,
  notes: "",
}

export const emptyType: TypeFormValues = {
  name: "",
  unit: TimeOffUnit.DAYS,
  requiresAllocation: true,
  approvalMode: ApprovalMode.MANAGER,
  workEntryLabel: "Leave Work Entry",
  isPaid: true,
  displayColor: "blue",
  active: true,
  description: "",
}

export const emptyAllocation: AllocationFormValues = {
  employeeId: "",
  typeId: "",
  allocated: "",
  validityLabel: "",
  description: "",
}

export const emptyRequest: RequestFormValues = {
  employeeId: "",
  typeId: "",
  startDate: "",
  endDate: "",
  reason: "",
}

export const emptyRule: RuleFormValues = {
  structureId: "",
  name: "",
  code: "",
  category: RuleCategory.ALLOWANCE,
  sequence: "10",
  computationType: ComputationType.FIXED,
  amount: "",
  percentage: "",
  percentageBase: PercentageBase.CONTRACT_WAGE,
  baseRuleCode: "",
  formula: "",
  quantity: "1",
  condition: "",
  active: true,
}
