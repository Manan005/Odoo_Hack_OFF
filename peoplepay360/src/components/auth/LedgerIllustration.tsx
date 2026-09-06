import type { CSSProperties, ReactNode } from "react"
import { cn } from "@/lib/utils"

/*
 * "The ledger writes itself." A payslip sheet, three salary-rule cards
 * (real seeded rule codes: BASIC, HRA, PF) whose connectors draw themselves
 * into the sheet, pulses that travel along them, bars that fill in the
 * brand-stripe colours (chart-1 basic, chart-5 allowance, chart-4 deduction)
 * and a PAID stamp that lands. Pure SVG + CSS classes from login.css; no JS,
 * no SMIL, no numerals (rules.md §0.3/§6 — every figure would be invented).
 *
 * Timeline (ms): sheet 0 · header 120–300 · cards 200–400 · connectors
 * 400–1200 · rows 560–980 · pulses 950+ (loop 6s) · bars 1500–2400 ·
 * stamp 2650. Bars widths are structural (basic + allowance − deduction =
 * net), not data.
 */

/** Delay for the ledger-* classes. `--ld` overrides the draw duration. */
const at = (ms: number, drawMs?: number) =>
  ({ "--lt": `${ms}ms`, ...(drawMs ? { "--ld": `${drawMs}ms` } : {}) }) as CSSProperties

const SHEET = { x: 232, y: 36, w: 296, h: 368, r: 18 }
const TRACK = { x: 352, w: 152 }

const RULES = [
  { code: "BASIC", cy: 108, row: 150, fill: "fill-chart-1", stroke: "stroke-chart-1", pop: 200, draw: 400, bar: 70, barAt: 1500 },
  { code: "HRA", cy: 200, row: 182, fill: "fill-chart-5", stroke: "stroke-chart-5", pop: 300, draw: 500, bar: 36, barAt: 1600 },
  { code: "PF", cy: 292, row: 214, fill: "fill-chart-4", stroke: "stroke-chart-4", pop: 400, draw: 600, bar: 18, barAt: 1700 },
] as const

/** S-bend from a rule card's right edge into the sheet's left edge. */
const connector = (cy: number, row: number) => `M164 ${cy} C200 ${cy} 196 ${row} 232 ${row}`

const sheetOutline = (() => {
  const { x, y, w, h, r } = SHEET
  return [
    `M${x + r} ${y}`,
    `H${x + w - r}`,
    `A${r} ${r} 0 0 1 ${x + w} ${y + r}`,
    `V${y + h - r}`,
    `A${r} ${r} 0 0 1 ${x + w - r} ${y + h}`,
    `H${x + r}`,
    `A${r} ${r} 0 0 1 ${x} ${y + h - r}`,
    `V${y + r}`,
    `A${r} ${r} 0 0 1 ${x + r} ${y}`,
    "Z",
  ].join(" ")
})()

function Row({
  label,
  y,
  delay,
  rule,
  children,
}: {
  label: string
  y: number
  delay: number
  /** y of the hairline beneath the row; omitted for the last row. */
  rule?: number
  children?: ReactNode
}) {
  return (
    <g>
      <g className="ledger-fade" style={at(delay)}>
        <text x={256} y={y + 4} fontSize={9.5} fontWeight={500} letterSpacing="0.12em" fill="currentColor" fillOpacity={0.55}>
          {label}
        </text>
        <rect x={TRACK.x} y={y - 4} width={TRACK.w} height={8} rx={4} fill="currentColor" fillOpacity={0.06} />
      </g>
      {rule !== undefined && (
        <path
          d={`M256 ${rule} H504`}
          pathLength={1}
          className="ledger-draw"
          style={at(delay, 400)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={0.1}
          strokeWidth={1}
        />
      )}
      {children}
    </g>
  )
}

export function LedgerIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 560 440"
      role="img"
      aria-label="A payslip drawing itself: three salary rules — basic, house rent allowance and provident fund — connect into a payslip, its lines fill in, and it is stamped paid."
      className={cn("ledger text-ink-fg", className)}
    >
      <g className="ledger-float">
        <g className="ledger-layer ledger-layer-mid">
          {/* ── Salary rules ─────────────────────────────────────────── */}
          <text
            x={28}
            y={66}
            fontSize={9}
            fontWeight={600}
            letterSpacing="0.18em"
            fill="currentColor"
            fillOpacity={0.45}
            className="ledger-fade"
            style={at(200)}
          >
            Salary rules
          </text>

          {RULES.map((r) => (
            <g key={r.code}>
              <g className="ledger-pop" style={at(r.pop)}>
                <rect
                  x={28}
                  y={r.cy - 24}
                  width={136}
                  height={48}
                  rx={12}
                  fill="currentColor"
                  fillOpacity={0.04}
                  stroke="currentColor"
                  strokeOpacity={0.3}
                  strokeWidth={1}
                />
                <rect x={44} y={r.cy - 10} width={8} height={8} rx={2.5} className={r.fill} />
                <text x={58} y={r.cy - 2} fontSize={11} fontWeight={600} letterSpacing="0.12em" fill="currentColor" fillOpacity={0.85}>
                  {r.code}
                </text>
                <rect x={58} y={r.cy + 5} width={64} height={3} rx={1.5} fill="currentColor" fillOpacity={0.22} />
              </g>

              {/* Connector draws itself, then a pulse rides it every 6s. */}
              <path
                d={connector(r.cy, r.row)}
                pathLength={1}
                className="ledger-draw"
                style={at(r.draw, 600)}
                fill="none"
                stroke="currentColor"
                strokeOpacity={0.45}
                strokeWidth={1.25}
              />
              <path
                d={connector(r.cy, r.row)}
                pathLength={1}
                className={cn("ledger-pulse", r.stroke)}
                style={at(r.draw + 550)}
                fill="none"
                strokeWidth={2.5}
              />
              <circle cx={232} cy={r.row} r={3} className={cn("ledger-pop", r.fill)} style={at(r.draw + 600)} />
            </g>
          ))}

          {/* ── Payslip sheet ────────────────────────────────────────── */}
          <rect
            x={SHEET.x}
            y={SHEET.y}
            width={SHEET.w}
            height={SHEET.h}
            rx={SHEET.r}
            fill="currentColor"
            fillOpacity={0.03}
            className="ledger-fade"
            style={at(0)}
          />
          <path
            d={sheetOutline}
            pathLength={1}
            className="ledger-draw"
            style={at(0, 800)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.35}
            strokeWidth={1.25}
          />

          {/* Header: title, period, employee — bars stand in for text so nothing is invented. */}
          <text
            x={256}
            y={70}
            fontSize={10}
            fontWeight={600}
            letterSpacing="0.16em"
            fill="currentColor"
            fillOpacity={0.6}
            className="ledger-fade"
            style={at(120)}
          >
            Payslip
          </text>
          <rect x={446} y={63} width={58} height={5} rx={2.5} fill="currentColor" fillOpacity={0.18} className="ledger-fade" style={at(160)} />
          <rect x={256} y={84} width={22} height={22} rx={7} fill="currentColor" fillOpacity={0.12} className="ledger-fade" style={at(200)} />
          <rect x={288} y={88} width={84} height={5} rx={2.5} fill="currentColor" fillOpacity={0.3} className="ledger-fade" style={at(240)} />
          <rect x={288} y={99} width={52} height={4} rx={2} fill="currentColor" fillOpacity={0.16} className="ledger-fade" style={at(280)} />
          <path
            d="M256 122 H504"
            pathLength={1}
            className="ledger-draw"
            style={at(300, 400)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.25}
            strokeWidth={1}
          />

          {/* Rule lines: one row per connected rule. */}
          {RULES.map((r, i) => (
            <Row key={r.code} label={r.code} y={r.row} delay={560 + i * 70} rule={i < 2 ? r.row + 14 : undefined}>
              <rect x={TRACK.x} y={r.row - 4} width={r.bar} height={8} rx={4} className={cn("ledger-bar", r.fill)} style={at(r.barAt)} />
            </Row>
          ))}

          {/* Divider, then the roll-ups: gross = basic + allowance, deduction cut from the right, net is what remains. */}
          <path
            d="M256 240 H504"
            pathLength={1}
            className="ledger-draw"
            style={at(770, 500)}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1}
          />
          <Row label="Gross" y={262} delay={840} rule={276}>
            <rect x={352} y={258} width={70} height={8} rx={4} className="ledger-bar fill-chart-1" style={at(2000)} />
            <rect x={418} y={258} width={40} height={8} rx={4} className="ledger-bar fill-chart-5" style={at(2100)} />
          </Row>
          <Row label="Deductions" y={294} delay={910} rule={308}>
            <rect x={440} y={290} width={18} height={8} rx={4} className="ledger-bar ledger-bar-right fill-chart-4" style={at(2250)} />
          </Row>
          <Row label="Net" y={326} delay={980}>
            <rect x={352} y={321} width={88} height={10} rx={5} fill="currentColor" fillOpacity={0.85} className="ledger-bar" style={at(2400)} />
          </Row>
        </g>

        {/* ── Stamp: floats above the paper, so it parallaxes more. ──── */}
        <g className="ledger-layer ledger-layer-front">
          <g transform="rotate(-8 452 372)">
            <g className="ledger-stamp" style={at(2650)}>
              <rect x={408} y={355} width={88} height={34} rx={8} fill="none" strokeWidth={2} className="stroke-chart-5" />
              <rect x={412} y={359} width={80} height={26} rx={5} fill="none" strokeWidth={0.75} strokeOpacity={0.55} className="stroke-chart-5" />
              <text
                x={453.5}
                y={377}
                textAnchor="middle"
                fontSize={13}
                fontWeight={700}
                letterSpacing="0.24em"
                className="fill-chart-5"
              >
                Paid
              </text>
            </g>
          </g>
        </g>
      </g>
    </svg>
  )
}
