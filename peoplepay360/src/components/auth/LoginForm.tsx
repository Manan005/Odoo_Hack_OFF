"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { loginAction } from "@/actions/auth.actions"
import { Button } from "@/components/ui/button"
import { Field, Input } from "@/components/ui/field"
import { loginSchema, type LoginInput } from "@/lib/validation/auth"

export function LoginForm() {
  const router = useRouter()
  const [formError, setFormError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  })

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null)
    const result = await loginAction(values)

    if (result.ok) {
      // Full navigation so the new session cookie reaches the server layout.
      router.replace("/")
      router.refresh()
      return
    }

    if (result.fieldErrors) {
      for (const [field, message] of Object.entries(result.fieldErrors)) {
        setError(field as keyof LoginInput, { message })
      }
    }
    setFormError(result.message)
    toast.error(result.message)
  })

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <Field label="Work Email" htmlFor="email" error={errors.email?.message}>
        <Input
          id="email"
          type="email"
          autoComplete="username"
          placeholder="name@company.com"
          error={Boolean(errors.email)}
          {...register("email")}
        />
      </Field>

      <Field label="Password" htmlFor="password" error={errors.password?.message}>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          placeholder="••••••••"
          error={Boolean(errors.password)}
          {...register("password")}
        />
      </Field>

      {formError && (
        <p role="alert" className="rounded-md bg-danger-subtle px-3 py-2 text-xs text-danger">
          {formError}
        </p>
      )}

      <Button
        type="submit"
        className="w-full"
        loading={isSubmitting}
        loadingText="Signing in…"
      >
        Sign In
      </Button>

      <button
        type="button"
        className="w-full text-center text-xs text-muted-foreground hover:text-primary"
        onClick={() => toast.info("Contact your administrator to reset your password.")}
      >
        Forgot password?
      </button>
    </form>
  )
}
