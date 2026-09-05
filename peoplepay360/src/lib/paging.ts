/**
 * List pagination.
 *
 * The page lives in the URL like every other filter (rules.md §2.4), so a
 * given page survives a refresh and can be shared. `useSearchParamWriter`
 * already drops `page` whenever any other filter changes, which is what stops
 * you landing on page 40 of a three-page result.
 */

export interface PageInfo {
  /** 1-based, clamped into range. */
  page: number
  pageSize: number
  total: number
  pageCount: number
  /** 1-based inclusive row numbers for the "51–100 of 2,858" label. */
  from: number
  to: number
}

/** A `page` query param that survives anything a user can type into the URL. */
export function parsePage(raw: string | undefined): number {
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.floor(n)
}

/**
 * Prisma `skip`/`take` for a page.
 *
 * Clamped against `total` so `?page=999` shows the last page rather than an
 * empty table — an empty table reads as "no data", which is a lie.
 */
export function pageInfo(page: number, pageSize: number, total: number): PageInfo {
  const pageCount = Math.max(1, Math.ceil(total / pageSize))
  const current = Math.min(Math.max(1, page), pageCount)
  const from = total === 0 ? 0 : (current - 1) * pageSize + 1
  const to = Math.min(current * pageSize, total)
  return { page: current, pageSize, total, pageCount, from, to }
}

export const pageSlice = (info: PageInfo): { skip: number; take: number } => ({
  skip: (info.page - 1) * info.pageSize,
  take: info.pageSize,
})
