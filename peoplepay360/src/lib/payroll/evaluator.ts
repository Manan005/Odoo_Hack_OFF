import { Prisma } from "@prisma/client"
import { SalaryRuleError } from "@/lib/result"

/**
 * A tiny expression interpreter for salary rule formulas.
 *
 * `eval`, `new Function` and `vm` are forbidden here (rules.md §4): a formula
 * is user-editable configuration, so evaluating it as JavaScript would be
 * remote code execution. Parsing it ourselves also lets us fail loudly with
 * the offending identifier, which AC-M7-2 requires.
 *
 * Grammar:
 *   expr    := compare
 *   compare := sum (('>' | '<' | '>=' | '<=' | '==' | '!=') sum)?
 *   sum     := term (('+' | '-') term)*
 *   term    := factor (('*' | '/') factor)*
 *   factor  := '-' factor | primary
 *   primary := number | ident | ident '(' args ')' | '(' expr ')'
 *
 * All arithmetic runs on Decimal — never float (rules.md §3).
 */

const D = Prisma.Decimal

type TokenType = "number" | "ident" | "op" | "lparen" | "rparen" | "comma" | "eof"

interface Token {
  type: TokenType
  value: string
  pos: number
}

const OPERATORS = [">=", "<=", "==", "!=", ">", "<", "+", "-", "*", "/"] as const

function tokenize(source: string, ruleName: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < source.length) {
    const ch = source[i]

    if (/\s/.test(ch)) {
      i++
      continue
    }

    if (/[0-9]/.test(ch) || (ch === "." && /[0-9]/.test(source[i + 1] ?? ""))) {
      let j = i
      while (j < source.length && /[0-9.]/.test(source[j])) j++
      const raw = source.slice(i, j)
      if ((raw.match(/\./g) ?? []).length > 1) {
        throw new SalaryRuleError(
          "INVALID_FORMULA",
          `Malformed number "${raw}" in rule "${ruleName}".`,
        )
      }
      tokens.push({ type: "number", value: raw, pos: i })
      i = j
      continue
    }

    if (/[A-Za-z_]/.test(ch)) {
      let j = i
      while (j < source.length && /[A-Za-z0-9_]/.test(source[j])) j++
      tokens.push({ type: "ident", value: source.slice(i, j), pos: i })
      i = j
      continue
    }

    const op = OPERATORS.find((o) => source.startsWith(o, i))
    if (op) {
      tokens.push({ type: "op", value: op, pos: i })
      i += op.length
      continue
    }

    if (ch === "(") {
      tokens.push({ type: "lparen", value: ch, pos: i })
      i++
      continue
    }
    if (ch === ")") {
      tokens.push({ type: "rparen", value: ch, pos: i })
      i++
      continue
    }
    if (ch === ",") {
      tokens.push({ type: "comma", value: ch, pos: i })
      i++
      continue
    }

    throw new SalaryRuleError(
      "INVALID_FORMULA",
      `Unexpected character "${ch}" at position ${i} in rule "${ruleName}".`,
    )
  }

  tokens.push({ type: "eof", value: "", pos: source.length })
  return tokens
}

/** Values a formula can read: rule codes already computed, plus context facts. */
export type Scope = Record<string, Prisma.Decimal>

const FUNCTIONS = new Set(["min", "max", "round", "abs", "floor", "ceil", "if"])

class Parser {
  private pos = 0

  constructor(
    private readonly tokens: Token[],
    private readonly scope: Scope,
    private readonly ruleName: string,
  ) {}

  private peek(): Token {
    return this.tokens[this.pos]
  }

  private next(): Token {
    return this.tokens[this.pos++]
  }

  private expect(type: TokenType, what: string): Token {
    const token = this.peek()
    if (token.type !== type) {
      throw new SalaryRuleError(
        "INVALID_FORMULA",
        `Expected ${what} in rule "${this.ruleName}" but found "${token.value || "end of formula"}".`,
      )
    }
    return this.next()
  }

  parse(): Prisma.Decimal {
    const value = this.parseCompare()
    if (this.peek().type !== "eof") {
      throw new SalaryRuleError(
        "INVALID_FORMULA",
        `Unexpected "${this.peek().value}" after the end of the expression in rule "${this.ruleName}".`,
      )
    }
    return value
  }

  /** Comparisons yield 1 or 0 so they compose with `if(...)`. */
  private parseCompare(): Prisma.Decimal {
    const left = this.parseSum()
    const token = this.peek()
    if (
      token.type === "op" &&
      [">", "<", ">=", "<=", "==", "!="].includes(token.value)
    ) {
      this.next()
      const right = this.parseSum()
      const result =
        token.value === ">"
          ? left.greaterThan(right)
          : token.value === "<"
            ? left.lessThan(right)
            : token.value === ">="
              ? left.greaterThanOrEqualTo(right)
              : token.value === "<="
                ? left.lessThanOrEqualTo(right)
                : token.value === "=="
                  ? left.equals(right)
                  : !left.equals(right)
      return new D(result ? 1 : 0)
    }
    return left
  }

  private parseSum(): Prisma.Decimal {
    let left = this.parseTerm()
    for (;;) {
      const token = this.peek()
      if (token.type !== "op" || (token.value !== "+" && token.value !== "-")) break
      this.next()
      const right = this.parseTerm()
      left = token.value === "+" ? left.plus(right) : left.minus(right)
    }
    return left
  }

  private parseTerm(): Prisma.Decimal {
    let left = this.parseFactor()
    for (;;) {
      const token = this.peek()
      if (token.type !== "op" || (token.value !== "*" && token.value !== "/")) break
      this.next()
      const right = this.parseFactor()
      if (token.value === "/") {
        if (right.isZero()) {
          throw new SalaryRuleError(
            "DIVISION_BY_ZERO",
            `Division by zero in rule "${this.ruleName}".`,
          )
        }
        left = left.div(right)
      } else {
        left = left.times(right)
      }
    }
    return left
  }

  private parseFactor(): Prisma.Decimal {
    const token = this.peek()
    if (token.type === "op" && token.value === "-") {
      this.next()
      return this.parseFactor().negated()
    }
    if (token.type === "op" && token.value === "+") {
      this.next()
      return this.parseFactor()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): Prisma.Decimal {
    const token = this.next()

    if (token.type === "number") return new D(token.value)

    if (token.type === "lparen") {
      const value = this.parseCompare()
      this.expect("rparen", "a closing parenthesis")
      return value
    }

    if (token.type === "ident") {
      // Function call?
      if (this.peek().type === "lparen") {
        const name = token.value.toLowerCase()
        if (!FUNCTIONS.has(name)) {
          throw new SalaryRuleError(
            "UNKNOWN_FUNCTION",
            `Unknown function "${token.value}" in rule "${this.ruleName}". Available: ${[...FUNCTIONS].join(", ")}.`,
          )
        }
        this.next() // consume '('
        const args: Prisma.Decimal[] = []
        if (this.peek().type !== "rparen") {
          args.push(this.parseCompare())
          while (this.peek().type === "comma") {
            this.next()
            args.push(this.parseCompare())
          }
        }
        this.expect("rparen", "a closing parenthesis")
        return this.callFunction(name, args)
      }

      // Plain identifier — a rule code or a context fact.
      const value = this.scope[token.value]
      if (value === undefined) {
        const available = Object.keys(this.scope).sort().join(", ")
        throw new SalaryRuleError(
          "UNKNOWN_IDENTIFIER",
          `Unknown identifier "${token.value}" in rule "${this.ruleName}". Available: ${available}.`,
        )
      }
      return value
    }

    throw new SalaryRuleError(
      "INVALID_FORMULA",
      `Unexpected "${token.value || "end of formula"}" in rule "${this.ruleName}".`,
    )
  }

  private callFunction(name: string, args: Prisma.Decimal[]): Prisma.Decimal {
    const arity = (n: number) => {
      if (args.length !== n) {
        throw new SalaryRuleError(
          "INVALID_FORMULA",
          `${name}() expects ${n} argument${n === 1 ? "" : "s"} in rule "${this.ruleName}", got ${args.length}.`,
        )
      }
    }

    switch (name) {
      case "min":
        if (args.length === 0) arity(1)
        return args.reduce((a, b) => (a.lessThan(b) ? a : b))
      case "max":
        if (args.length === 0) arity(1)
        return args.reduce((a, b) => (a.greaterThan(b) ? a : b))
      case "abs":
        arity(1)
        return args[0].abs()
      case "floor":
        arity(1)
        return args[0].floor()
      case "ceil":
        arity(1)
        return args[0].ceil()
      case "round":
        if (args.length === 1) return args[0].toDecimalPlaces(0)
        arity(2)
        return args[0].toDecimalPlaces(args[1].toNumber())
      case "if":
        arity(3)
        return args[0].isZero() ? args[2] : args[1]
      default:
        throw new SalaryRuleError(
          "UNKNOWN_FUNCTION",
          `Unknown function "${name}" in rule "${this.ruleName}".`,
        )
    }
  }
}

/**
 * Evaluate a formula against a scope. Throws SalaryRuleError naming the rule
 * on any failure — never silently returns 0 (rules.md §5).
 */
export function evaluateFormula(
  formula: string,
  scope: Scope,
  ruleName: string,
): Prisma.Decimal {
  const source = formula?.trim()
  if (!source) {
    throw new SalaryRuleError("INVALID_FORMULA", `Rule "${ruleName}" has an empty formula.`)
  }
  return new Parser(tokenize(source, ruleName), scope, ruleName).parse()
}

/** A rule's optional `condition` — the rule applies when this is truthy. */
export function evaluateCondition(
  condition: string,
  scope: Scope,
  ruleName: string,
): boolean {
  return !evaluateFormula(condition, scope, ruleName).isZero()
}
