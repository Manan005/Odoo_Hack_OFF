"use server"

import { AuthError as NextAuthError } from "next-auth"
import { signIn, signOut } from "@/auth"
import { db } from "@/lib/db"
import { landingForRoles } from "@/lib/nav"
import { fail, ok, type ActionResult } from "@/lib/result"
import { loginSchema } from "@/lib/validation/auth"

/**
 * Unauthenticated by design: this is the action that creates the session.
 * On success it returns the role's landing page, so the form can navigate
 * there in one hop instead of bouncing through "/" and a redirect.
 */
export async function loginAction(raw: unknown): Promise<ActionResult<{ landing: string }>> {
  const parsed = loginSchema.safeParse(raw)
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {}
    for (const issue of parsed.error.issues) {
      const key = issue.path[0]
      if (typeof key === "string" && !fieldErrors[key]) fieldErrors[key] = issue.message
    }
    return fail("VALIDATION", "Check the highlighted fields.", fieldErrors)
  }

  try {
    // The roles lookup runs beside the credential check rather than after it,
    // so it costs no extra round trip. Its result is used only once signIn has
    // succeeded; on failure it is discarded and nothing about the account leaks.
    const [, account] = await Promise.all([
      signIn("credentials", { ...parsed.data, redirect: false }),
      db.user.findUnique({
        where: { email: parsed.data.email.toLowerCase() },
        select: { roles: true },
      }),
    ])
    return ok({ landing: landingForRoles(account?.roles ?? []) })
  } catch (error) {
    // Auth.js surfaces every credential failure as CredentialsSignin. Do not
    // distinguish "no such user" from "wrong password" — that leaks account
    // existence to an unauthenticated caller.
    if (error instanceof NextAuthError) {
      return fail("INVALID_CREDENTIALS", "Incorrect email or password.")
    }
    console.error("[loginAction] unexpected error:", error)
    throw error
  }
}

export async function logoutAction(): Promise<void> {
  await signOut({ redirectTo: "/login" })
}
