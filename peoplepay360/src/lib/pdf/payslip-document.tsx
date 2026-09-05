import { RuleCategory } from "@prisma/client"
import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer"
import { amountInWords, formatINR } from "@/lib/money"

export interface PayslipPdfData {
  company: { name: string; address: string | null }
  reference: string
  periodLabel: string
  workedDays: string
  status: string
  employee: {
    name: string
    code: string
    department: string | null
    position: string | null
    bankAccountMasked: string
  }
  contract: { reference: string; wage: string } | null
  structureName: string
  payrunName: string
  lines: Array<{
    name: string
    code: string
    category: RuleCategory
    amount: string
  }>
  totals: {
    basic: string
    allowances: string
    gross: string
    deductions: string
    net: string
  }
}

const s = StyleSheet.create({
  page: { padding: 36, fontSize: 9, color: "#1e293b", fontFamily: "Helvetica" },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 2,
    borderBottomColor: "#4f46e5",
    paddingBottom: 10,
    marginBottom: 14,
  },
  company: { fontSize: 15, fontFamily: "Helvetica-Bold", color: "#4f46e5" },
  companyMeta: { fontSize: 8, color: "#64748b", marginTop: 2 },
  docTitle: { fontSize: 12, fontFamily: "Helvetica-Bold", textAlign: "right" },
  docMeta: { fontSize: 8, color: "#64748b", textAlign: "right", marginTop: 2 },

  section: { marginBottom: 14 },
  sectionTitle: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#64748b",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    paddingBottom: 3,
    marginBottom: 6,
  },

  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: "25%", marginBottom: 6 },
  cellWide: { width: "50%", marginBottom: 6 },
  label: { fontSize: 7, color: "#64748b", textTransform: "uppercase", letterSpacing: 0.4 },
  value: { fontSize: 9, marginTop: 1 },

  columns: { flexDirection: "row", gap: 14 },
  column: { flex: 1 },

  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 3,
    borderBottomWidth: 1,
    borderBottomColor: "#f1f5f9",
  },
  rowLabel: { fontSize: 9 },
  rowCode: { fontSize: 7, color: "#94a3b8" },
  rowAmount: { fontSize: 9 },
  deduction: { color: "#dc2626" },

  subtotal: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
    marginTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#cbd5e1",
  },
  subtotalText: { fontSize: 9, fontFamily: "Helvetica-Bold" },

  net: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#eef2ff",
    borderWidth: 1,
    borderColor: "#c7d2fe",
    borderRadius: 3,
    padding: 9,
    marginTop: 12,
  },
  netLabel: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#4f46e5" },
  netAmount: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#4f46e5" },
  words: { fontSize: 8, color: "#475569", marginTop: 6, fontStyle: "italic" },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 36,
    right: 36,
    fontSize: 7,
    color: "#94a3b8",
    textAlign: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 6,
  },
})

const Field = ({
  label,
  value,
  wide,
}: {
  label: string
  value: string
  wide?: boolean
}) => (
  <View style={wide ? s.cellWide : s.cell}>
    <Text style={s.label}>{label}</Text>
    <Text style={s.value}>{value}</Text>
  </View>
)

/**
 * Every amount here comes from a PayslipLine, which came from a SalaryRule —
 * there is no computation in this document (AC-M9-1, AC-M9-3).
 */
export function PayslipDocument({ data }: { data: PayslipPdfData }) {
  const earnings = data.lines.filter(
    (l) => l.category === RuleCategory.BASIC || l.category === RuleCategory.ALLOWANCE,
  )
  const deductions = data.lines.filter((l) => l.category === RuleCategory.DEDUCTION)

  return (
    <Document
      title={`Payslip ${data.reference} — ${data.employee.name}`}
      author={data.company.name}
    >
      <Page size="A4" style={s.page}>
        <View style={s.header}>
          <View>
            <Text style={s.company}>{data.company.name}</Text>
            {data.company.address && <Text style={s.companyMeta}>{data.company.address}</Text>}
          </View>
          <View>
            <Text style={s.docTitle}>PAYSLIP</Text>
            <Text style={s.docMeta}>{data.periodLabel}</Text>
            <Text style={s.docMeta}>{data.reference}</Text>
          </View>
        </View>

        <View style={s.section}>
          <Text style={s.sectionTitle}>Employee</Text>
          <View style={s.grid}>
            <Field label="Name" value={data.employee.name} />
            <Field label="Employee Code" value={data.employee.code} />
            <Field label="Department" value={data.employee.department ?? "—"} />
            <Field label="Job Position" value={data.employee.position ?? "—"} />
            <Field label="Bank Account" value={data.employee.bankAccountMasked} />
            <Field label="Worked Days" value={data.workedDays} />
            <Field label="Contract" value={data.contract?.reference ?? "—"} />
            <Field
              label="Contract Wage"
              value={data.contract ? formatINR(data.contract.wage) : "—"}
            />
            <Field label="Salary Structure" value={data.structureName} />
            <Field label="Pay Run" value={data.payrunName} />
            <Field label="Status" value={data.status} />
          </View>
        </View>

        <View style={s.columns}>
          <View style={s.column}>
            <Text style={s.sectionTitle}>Earnings</Text>
            {earnings.map((l) => (
              <View key={l.code} style={s.row}>
                <View>
                  <Text style={s.rowLabel}>{l.name}</Text>
                  <Text style={s.rowCode}>{l.code}</Text>
                </View>
                <Text style={s.rowAmount}>{formatINR(l.amount)}</Text>
              </View>
            ))}
            <View style={s.subtotal}>
              <Text style={s.subtotalText}>Gross</Text>
              <Text style={s.subtotalText}>{formatINR(data.totals.gross)}</Text>
            </View>
          </View>

          <View style={s.column}>
            <Text style={s.sectionTitle}>Deductions</Text>
            {deductions.length === 0 && <Text style={s.rowLabel}>None</Text>}
            {deductions.map((l) => (
              <View key={l.code} style={s.row}>
                <View>
                  <Text style={s.rowLabel}>{l.name}</Text>
                  <Text style={s.rowCode}>{l.code}</Text>
                </View>
                <Text style={[s.rowAmount, s.deduction]}>−{formatINR(l.amount)}</Text>
              </View>
            ))}
            <View style={s.subtotal}>
              <Text style={s.subtotalText}>Total Deductions</Text>
              <Text style={[s.subtotalText, s.deduction]}>
                −{formatINR(data.totals.deductions)}
              </Text>
            </View>
          </View>
        </View>

        <View style={s.net}>
          <Text style={s.netLabel}>NET SALARY</Text>
          <Text style={s.netAmount}>{formatINR(data.totals.net)}</Text>
        </View>
        <Text style={s.words}>{amountInWords(data.totals.net)}</Text>

        <Text style={s.footer} fixed>
          Computer-generated payslip — no signature required. Every amount is produced by the
          salary rules of the {data.structureName} structure.
        </Text>
      </Page>
    </Document>
  )
}

/** Shared loader so the route and the mailer render identical PDFs. */
export function toPdfData(payslip: {
  reference: string
  periodLabel: string
  workedDays: unknown
  status: string
  employee: {
    firstName: string
    lastName: string
    employeeCode: string
    bankAccountNumber: string | null
    department: { name: string } | null
    jobPosition: { name: string } | null
  }
  contract: { reference: string; wage: unknown } | null
  payrun: { name: string; structure: { name: string } }
  lines: Array<{ name: string; code: string; category: RuleCategory; amount: unknown }>
  basic: unknown
  allowances: unknown
  gross: unknown
  deductions: unknown
  net: unknown
  company: { name: string; address: string | null }
}): PayslipPdfData {
  const account = payslip.employee.bankAccountNumber
  return {
    company: payslip.company,
    reference: payslip.reference,
    periodLabel: payslip.periodLabel,
    workedDays: String(payslip.workedDays),
    status: payslip.status,
    employee: {
      name: `${payslip.employee.firstName} ${payslip.employee.lastName}`,
      code: payslip.employee.employeeCode,
      department: payslip.employee.department?.name ?? null,
      position: payslip.employee.jobPosition?.name ?? null,
      // Never print a full account number on a document that gets emailed.
      bankAccountMasked: account ? `•••• ${account.slice(-4)}` : "not on file",
    },
    contract: payslip.contract
      ? { reference: payslip.contract.reference, wage: String(payslip.contract.wage) }
      : null,
    structureName: payslip.payrun.structure.name,
    payrunName: payslip.payrun.name,
    lines: payslip.lines.map((l) => ({
      name: l.name,
      code: l.code,
      category: l.category,
      amount: String(l.amount),
    })),
    totals: {
      basic: String(payslip.basic),
      allowances: String(payslip.allowances),
      gross: String(payslip.gross),
      deductions: String(payslip.deductions),
      net: String(payslip.net),
    },
  }
}
