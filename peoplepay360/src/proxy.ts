import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Next 16 renamed the `middleware` convention to `proxy`; the runtime is nodejs
// and is not configurable. Coarse gate only — unauthenticated requests bounce to
// /login. Real authorization happens per page and per Server Action (rules.md §4).
export const { auth: proxy } = NextAuth(authConfig)

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
}
