"use server"

import { AuthError as NextAuthError } from "next-auth"
import { signIn, signOut } from "@/auth"
import { fail, ok, type ActionResult } from "@/lib/result"
import { loginSchema } from "@/lib/validation/auth"

export async function loginAction(raw: unknown): Promise<ActionResult<void>> {
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
    await signIn("credentials", { ...parsed.data, redirect: false })
    return ok(undefined)
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
