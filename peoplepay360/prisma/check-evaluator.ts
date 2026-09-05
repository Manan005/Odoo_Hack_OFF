/**
 * Unit check for the salary-rule expression interpreter. No database.
 * Run: npx tsx prisma/check-evaluator.ts
 */
import { Prisma } from "@prisma/client"
import { evaluateCondition, evaluateFormula, type Scope } from "../src/lib/payroll/evaluator"

const D = Prisma.Decimal
const scope: Scope = {
  BASIC: new D(42500),
  HRA: new D(8500),
  STD: new D(3000),
  GROSS: new D(54000),
  PF: new D(5100),
  wage: new D(85000),
  workedDays: new D(22),
  scheduledDays: new D(22),
  overtimeHours: new D(6),
  hourlyRate: new D(490.38),
  perDayRate: new D(3863.64),
  unpaidLeaveDays: new D(2),
}

let pass = 0
let fail = 0

const eq = (label: string, formula: string, expected: string) => {
  try {
    const got = evaluateFormula(formula, scope, "Test Rule").toDecimalPlaces(2).toString()
    const ok = got === expected
    ok ? pass++ : fail++
    console.log(`  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(34)} ${formula.padEnd(46)} = ${got}${ok ? "" : `  (expected ${expected})`}`)
  } catch (e) {
    fail++
    console.log(`  FAIL  ${label.padEnd(34)} ${formula.padEnd(46)} threw: ${(e as Error).message}`)
  }
}

const throws = (label: string, formula: string, expectCode: string) => {
  try {
    evaluateFormula(formula, scope, "Test Rule")
    fail++
    console.log(`  FAIL  ${label.padEnd(34)} ${formula.padEnd(46)} did NOT throw`)
  } catch (e) {
    const err = e as { code?: string; message: string }
    const ok = err.code === expectCode
    ok ? pass++ : fail++
    console.log(
      `  ${ok ? "PASS" : "FAIL"}  ${label.padEnd(34)} ${formula.padEnd(46)} ${err.code}${ok ? "" : ` (expected ${expectCode})`}`,
    )
    if (ok) console.log(`        ${err.message}`)
  }
}

console.log("Arithmetic")
eq("addition", "BASIC + HRA", "51000")
eq("precedence", "BASIC + HRA * 2", "59500")
eq("parentheses override", "(BASIC + HRA) * 2", "102000")
eq("subtraction chain", "GROSS - PF - 200", "48700")
eq("division", "wage / 2", "42500")
eq("unary minus", "-BASIC + GROSS", "11500")
eq("decimal literal", "BASIC * 0.12", "5100")

console.log("\nThe reference rule set")
eq("BASIC = 50% of wage", "wage * 50 / 100", "42500")
eq("HRA = 20% of BASIC", "BASIC * 20 / 100", "8500")
eq("GROSS sum", "BASIC + HRA + STD", "54000")
eq("overtime pay", "overtimeHours * hourlyRate * 1.5", "4413.42")
eq("unpaid leave deduction", "unpaidLeaveDays * perDayRate", "7727.28")
eq("NET", "GROSS - PF", "48900")
eq("attendance-scaled basic", "round(BASIC * workedDays / scheduledDays, 2)", "42500")

console.log("\nFunctions")
eq("min", "min(BASIC, HRA)", "8500")
eq("max of three", "max(BASIC, HRA, STD)", "42500")
eq("round to 2dp", "round(1234.5678, 2)", "1234.57")
eq("round to integer", "round(1234.5678)", "1235")
eq("abs", "abs(0 - BASIC)", "42500")
eq("floor", "floor(8.9)", "8")
eq("ceil", "ceil(8.1)", "9")
eq("nested calls", "max(min(BASIC, 50000), 10000)", "42500")

console.log("\nComparisons and conditionals")
eq("greater than -> 1", "workedDays > 20", "1")
eq("less than -> 0", "workedDays < 20", "0")
eq("equality", "workedDays == scheduledDays", "1")
eq("inequality", "workedDays != scheduledDays", "0")
eq("bonus when full attendance", "if(workedDays >= scheduledDays, BASIC * 0.10, 0)", "4250")
eq("bonus withheld", "if(workedDays > scheduledDays, BASIC * 0.10, 0)", "0")
eq("nested if", "if(GROSS > 50000, if(PF > 5000, 100, 200), 300)", "100")

console.log("\nConditions (rule gating)")
for (const [expr, expected] of [
  ["workedDays >= scheduledDays", true],
  ["unpaidLeaveDays > 0", true],
  ["unpaidLeaveDays > 5", false],
] as const) {
  const got = evaluateCondition(expr, scope, "Test Rule")
  const ok = got === expected
  ok ? pass++ : fail++
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${expr.padEnd(40)} -> ${got}`)
}

console.log("\nErrors must be loud and name the rule (AC-M7-2)")
throws("unknown identifier", "BASIC + NOPE", "UNKNOWN_IDENTIFIER")
throws("unknown function", "frobnicate(BASIC)", "UNKNOWN_FUNCTION")
throws("division by zero", "BASIC / 0", "DIVISION_BY_ZERO")
throws("unbalanced parens", "(BASIC + HRA", "INVALID_FORMULA")
throws("trailing garbage", "BASIC HRA", "INVALID_FORMULA")
throws("empty formula", "   ", "INVALID_FORMULA")
throws("bad character", "BASIC $ HRA", "INVALID_FORMULA")
throws("wrong arity", "round(1, 2, 3)", "INVALID_FORMULA")
throws("malformed number", "1.2.3 + BASIC", "INVALID_FORMULA")

console.log("\nNo code execution — these are data, not JavaScript")
throws("property access", "BASIC.constructor", "INVALID_FORMULA")
throws("global lookup", "process", "UNKNOWN_IDENTIFIER")
// Rejected at the tokenizer by the quote, before function resolution.
throws("call through global", "require('fs')", "INVALID_FORMULA")
throws("template injection", "`${process.env}`", "INVALID_FORMULA")
throws("statement separator", "BASIC; drop", "INVALID_FORMULA")

console.log(`\n${pass} passed, ${fail} failed`)
process.exit(fail === 0 ? 0 : 1)
