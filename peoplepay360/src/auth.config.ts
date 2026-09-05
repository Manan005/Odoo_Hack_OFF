import type { NextAuthConfig } from "next-auth"

/**
 * Edge-safe half of the Auth.js config — no Prisma, no bcrypt.
 * `middleware.ts` imports this; `auth.ts` extends it with the Credentials
 * provider, which needs Node APIs.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 12,
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user)
      const { pathname } = request.nextUrl
      if (pathname.startsWith("/login")) return true
      return isLoggedIn
    },
  },
} satisfies NextAuthConfig
