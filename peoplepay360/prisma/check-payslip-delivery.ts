/**
 * P7 gate — payslip PDF and email delivery.
 *
 * The PDF comes from the real /api/payslips/[id]/pdf route over HTTP, so this
 * exercises the same rendering path the app uses. It is then sent through the
 * same nodemailer transport configuration as lib/mail/send-payslips.ts and
 * confirmed in MailHog.
 *
 * Requires the dev server on :3000 and MailHog on :1025 / :8025.
 */
import { inflateSync } from "node:zlib"
import { PrismaClient } from "@prisma/client"
import nodemailer from "nodemailer"

const db = new PrismaClient()
const APP = "http://localhost:3000"
const MAILHOG = "http://localhost:8025"

async function login(email: string): Promise<string> {
  const csrfRes = await fetch(`${APP}/api/auth/csrf`)
  const cookies: string[] = []
  const collect = (res: Response) => {
    const raw = res.headers.getSetCookie?.() ?? []
    for (const c of raw) cookies.push(c.split(";")[0])
  }
  collect(csrfRes)
  const { csrfToken } = (await csrfRes.json()) as { csrfToken: string }

  const res = await fetch(`${APP}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Cookie: cookies.join("; "),
    },
    body: new URLSearchParams({
      csrfToken,
      email,
      password: "demo1234",
      redirect: "false",
      callbackUrl: `${APP}/`,
    }),
    redirect: "manual",
  })
  collect(res)
  return cookies.join("; ")
}

/**
 * Every codepoint the PDF claims it can map back to text, read out of the
 * embedded fonts' /ToUnicode CMaps. Those streams are Flate-compressed, so the
 * file is scanned for stream blocks and each one is inflated; anything that is
 * not a CMap simply fails to inflate or contains no `beginbfchar`.
 */
function mappedCodepoints(pdf: Buffer): Set<number> {
  const found = new Set<number>()
  let at = 0
  for (;;) {
    const start = pdf.indexOf("stream", at)
    if (start < 0) break
    const end = pdf.indexOf("endstream", start)
    if (end < 0) break
    at = end + 9

    // Skip the EOL that must follow the `stream` keyword.
    let from = start + 6
    if (pdf[from] === 0x0d) from++
    if (pdf[from] === 0x0a) from++

    let text: string
    try {
      text = inflateSync(pdf.subarray(from, end)).toString("latin1")
    } catch {
      continue
    }
    if (!text.includes("beginbfchar") && !text.includes("beginbfrange")) continue

    // `<src> <dst>` pairs.
    for (const block of text.matchAll(/beginbfchar([\s\S]*?)endbfchar/g)) {
      for (const m of block[1].matchAll(/<[0-9a-fA-F]+>\s*<([0-9a-fA-F]{4,})>/g)) {
        found.add(Number.parseInt(m[1].slice(0, 4), 16))
      }
    }

    // `<lo> <hi> <dst>` triples, where dst is either a starting codepoint or an
    // explicit array. Missing these is why the em dash first read as absent.
    for (const block of text.matchAll(/beginbfrange([\s\S]*?)endbfrange/g)) {
      for (const m of block[1].matchAll(
        /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>\s*(?:<([0-9a-fA-F]{4,})>|\[([\s\S]*?)\])/g,
      )) {
        const span = Number.parseInt(m[2], 16) - Number.parseInt(m[1], 16)
        if (m[3]) {
          const start = Number.parseInt(m[3].slice(0, 4), 16)
          for (let i = 0; i <= span; i++) found.add(start + i)
        } else if (m[4]) {
          for (const one of m[4].matchAll(/<([0-9a-fA-F]{4,})>/g)) {
            found.add(Number.parseInt(one[1].slice(0, 4), 16))
          }
        }
      }
    }
  }
  return found
}

async function main() {
  console.log("Signing in as the payroll manager…")
  const cookie = await login("nisha@oxp.com")

  const slips = await db.payslip.findMany({
    where: { contractId: { not: null } },
    take: 3,
    select: {
      id: true,
      reference: true,
      net: true,
      employee: { select: { firstName: true, lastName: true, workEmail: true } },
    },
  })
  console.log(`Payslips to deliver: ${slips.length}\n`)

  console.log("AC-M9-3 — PDF renders through the app route")
  const rendered: Array<{ name: string; email: string | null; buffer: Buffer; file: string }> = []
  for (const slip of slips) {
    const res = await fetch(`${APP}/api/payslips/${slip.id}/pdf`, { headers: { Cookie: cookie } })
    if (!res.ok) {
      console.log(`  ${slip.reference}: HTTP ${res.status} FAIL`)
      continue
    }
    const buffer = Buffer.from(await res.arrayBuffer())
    const magic = buffer.subarray(0, 5).toString("latin1")
    const disposition = res.headers.get("content-disposition") ?? ""
    const file = /filename="([^"]+)"/.exec(disposition)?.[1] ?? `${slip.reference}.pdf`
    const who = `${slip.employee.firstName} ${slip.employee.lastName}`
    console.log(
      `  ${who.padEnd(20)} ${(buffer.length / 1024).toFixed(1).padStart(6)} KB  ${magic === "%PDF-" ? "PASS" : `FAIL (${magic})`}  ${file}`,
    )
    rendered.push({ name: who, email: slip.employee.workEmail, buffer, file })
  }

  console.log("\nCurrency and sign glyphs survive into the PDF")
  {
    const pdf = rendered[0].buffer
    const cps = mappedCodepoints(pdf)
    const wanted: Array<[string, number]> = [
      ["₹ rupee   U+20B9", 0x20b9],
      ["− minus   U+2212", 0x2212],
      ["— em dash U+2014", 0x2014],
    ]
    for (const [label, cp] of wanted) {
      console.log(`  ${label}  ${cps.has(cp) ? "PASS" : "FAIL — not mapped by any embedded font"}`)
    }
    const embedsNoto = pdf.includes("NotoSans")
    const usesBuiltin = pdf.includes("/BaseFont /Helvetica")
    console.log(`  embeds NotoSans: ${embedsNoto ? "yes PASS" : "no FAIL"}`)
    console.log(
      `  built-in Helvetica: ${usesBuiltin ? "still referenced FAIL" : "gone PASS"}` +
        "  (WinAnsi has no ₹, which printed it as ¹)",
    )
  }

  console.log("\nThe payslip downloads rather than opening in the tab")
  {
    const id = slips[0].id
    for (const [label, url, expect] of [
      ["default ", `${APP}/api/payslips/${id}/pdf`, "attachment"],
      ["?view=1", `${APP}/api/payslips/${id}/pdf?view=1`, "inline"],
    ] as const) {
      const res = await fetch(url, { headers: { Cookie: cookie } })
      const cd = res.headers.get("content-disposition") ?? ""
      console.log(`  ${label} → ${cd.padEnd(46)} ${cd.startsWith(expect) ? "PASS" : "FAIL"}`)
    }
  }

  console.log("\nAC-M9-4 — bulk email with the PDF attached")
  const before = await fetch(`${MAILHOG}/api/v2/messages?limit=1`)
    .then((r) => r.json() as Promise<{ total: number }>)
    .then((j) => j.total)
    .catch(() => -1)
  if (before < 0) {
    console.log("  MailHog is not reachable on :8025 — start it with docker compose up -d")
    return
  }
  console.log(`  MailHog messages before: ${before}`)

  const mail = nodemailer.createTransport({
    host: process.env.SMTP_HOST ?? "localhost",
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    ignoreTLS: true,
  })

  let sent = 0
  const skipped: string[] = []
  for (const r of rendered) {
    if (!r.email) {
      skipped.push(`${r.name} — no work email on file`)
      continue
    }
    await mail.sendMail({
      from: process.env.SMTP_FROM ?? "PeoplePay360 <payroll@oxp.com>",
      to: r.email,
      subject: "Payslip — gate check",
      text: `Hello ${r.name}, your payslip is attached.`,
      attachments: [{ filename: r.file, content: r.buffer, contentType: "application/pdf" }],
    })
    sent++
  }
  console.log(`  sent ${sent}, skipped ${skipped.length}`)
  for (const s of skipped) console.log(`    ${s}`)

  const after = await fetch(`${MAILHOG}/api/v2/messages?limit=20`).then(
    (r) => r.json() as Promise<{ total: number; items: Array<{ Content: { Headers: Record<string, string[]> } }> }>,
  )
  console.log(`  MailHog messages after : ${after.total}`)
  console.log(
    `  delivered ${after.total - before} ${after.total - before === sent ? "PASS" : "FAIL"}`,
  )

  const withAttachment = after.items.filter((m) =>
    (m.Content.Headers["Content-Type"]?.[0] ?? "").includes("multipart/mixed"),
  ).length
  console.log(`  messages carrying an attachment: ${withAttachment}`)
  console.log(`\nInspect them at ${MAILHOG}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => db.$disconnect())
