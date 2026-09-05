import NextAuth from "next-auth"
import type { NextFetchEvent, NextRequest } from "next/server"
import { authConfig } from "@/auth.config"

// Next 16 renamed the `middleware` convention to `proxy`; the runtime is nodejs
// and is not configurable. Coarse gate only — unauthenticated requests bounce to
// /login. Real authorization happens per page and per Server Action (rules.md §4).
const { auth } = NextAuth(authConfig)

/**
 * Next statically checks that this file exports a *function*. The shorter
 * `export const { auth: proxy } = NextAuth(...)` is a destructuring
 * declaration, which that check cannot see through — it logged an error on
 * every cold start even though the handler did run. Wrapping it keeps the
 * behaviour and quiets the false alarm.
 */
export default function proxy(request: NextRequest, event: NextFetchEvent) {
  const handler = auth as unknown as (
    request: NextRequest,
    event: NextFetchEvent,
  ) => Promise<Response | undefined>
  return handler(request, event)
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
}
