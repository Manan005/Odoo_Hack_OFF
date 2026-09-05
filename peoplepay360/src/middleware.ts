import NextAuth from "next-auth"
import { authConfig } from "@/auth.config"

// Coarse gate only — unauthenticated requests bounce to /login.
// Real authorization happens per page and per Server Action (rules.md §4).
export const { auth: middleware } = NextAuth(authConfig)

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.png$|.*\\.svg$).*)"],
}
