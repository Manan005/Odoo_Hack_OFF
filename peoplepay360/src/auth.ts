import type { Role } from "@prisma/client"
import bcrypt from "bcryptjs"
import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { z } from "zod"
import { authConfig } from "@/auth.config"
import { db } from "@/lib/db"

declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      roles: Role[]
      employeeId: string | null
      companyId: string
    }
  }

  interface User {
    id?: string
    email?: string | null
    name?: string | null
    roles: Role[]
    employeeId: string | null
    companyId: string
  }
}

// next-auth v5 re-exports the JWT type from @auth/core; augmenting the
// "next-auth/jwt" path does not resolve under moduleResolution: bundler.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string
    roles: Role[]
    employeeId: string | null
    companyId: string
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
})

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Work Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw)
        if (!parsed.success) return null

        const { email, password } = parsed.data
        const user = await db.user.findUnique({
          where: { email: email.toLowerCase() },
          include: {
            employee: {
              select: { id: true, firstName: true, lastName: true, companyId: true },
            },
          },
        })

        // Inactive users cannot sign in (AC-M0-4).
        if (!user || !user.active) return null

        const valid = await bcrypt.compare(password, user.passwordHash)
        if (!valid) return null

        await db.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        })

        return {
          id: user.id,
          email: user.email,
          name: user.employee
            ? `${user.employee.firstName} ${user.employee.lastName}`
            : user.email,
          roles: user.roles,
          employeeId: user.employee?.id ?? null,
          companyId: user.employee?.companyId ?? "",
        }
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!
        token.roles = user.roles
        token.employeeId = user.employeeId
        token.companyId = user.companyId
      }
      return token
    },
    session({ session, token }) {
      session.user.id = token.id
      session.user.roles = token.roles
      session.user.employeeId = token.employeeId
      session.user.companyId = token.companyId
      return session
    },
  },
})
