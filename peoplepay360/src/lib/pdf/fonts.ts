import path from "node:path"
import { Font } from "@react-pdf/renderer"

/**
 * The PDF font family.
 *
 * The built-in PDF fonts (Helvetica and friends) are Type 1 with WinAnsi
 * encoding, which has no `₹` (U+20B9) and no true minus `−` (U+2212). Neither
 * character errors — the renderer just emits the wrong glyph, which is why
 * every amount printed as `¹95,000.00` and the deduction minus vanished.
 *
 * Noto Sans covers both. It ships under the SIL Open Font License; see
 * `public/fonts/OFL.txt`.
 *
 * The files live in `public/` rather than beside this module because Next does
 * not trace binary assets imported by server code into the build output, but it
 * does copy `public/` verbatim — so this path resolves in `next dev` and in a
 * built server alike.
 */
export const PDF_FONT = "Noto Sans"

const fontPath = (file: string) => path.join(process.cwd(), "public", "fonts", file)

let registered = false

/** Idempotent — `Font.register` is global, and this module may load more than once. */
export function registerPdfFonts(): void {
  if (registered) return
  Font.register({
    family: PDF_FONT,
    fonts: [
      { src: fontPath("NotoSans-Regular.ttf"), fontWeight: 400 },
      { src: fontPath("NotoSans-Bold.ttf"), fontWeight: 700 },
    ],
  })
  // Noto Sans has no hyphenation data here, and a payslip has no prose worth
  // breaking; without this the renderer splits long rule names mid-word.
  Font.registerHyphenationCallback((word) => [word])
  registered = true
}
