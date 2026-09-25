import { PrismaClient } from "@prisma/client"

// Next.js dev server hot-reloads modules; without the global cache every reload
// opens a fresh connection pool until Postgres refuses new connections.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

/**
 * DATABASE_URL with pool defaults filled in. Prisma's default pool is
 * `cores * 2 + 1` connections (9 on a 4-thread laptop), but one dashboard
 * render issues ~24 independent statements at once; against a remote
 * database each extra queue turn costs a full round trip. 20 lets that wave
 * run nearly in one turn. Values already present in the URL always win.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.DATABASE_URL
  if (!raw) return undefined
  try {
    const url = new URL(raw)
    if (!url.searchParams.has("connection_limit")) url.searchParams.set("connection_limit", "20")
    if (!url.searchParams.has("pool_timeout")) url.searchParams.set("pool_timeout", "20")
    return url.toString()
  } catch {
    return raw
  }
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: datasourceUrl(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db
