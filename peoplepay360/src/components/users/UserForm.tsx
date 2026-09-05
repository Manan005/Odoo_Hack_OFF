"use client"

import { Role } from "@prisma/client"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { createUser, updateUser } from "@/actions/user.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Input, Label, Select } from "@/components/ui/field"
import { ROLE_LABEL } from "@/lib/auth-guard"

const ROLE_ORDER: Role[] = [
  Role.EMPLOYEE,
  Role.HR_MANAGER,
  Role.HR_PAYROLL_USER,
  Role.HR_PAYROLL_MANAGER,
  Role.ADMIN,
]

const ROLE_HINT: Record<Role, string> = {
  EMPLOYEE: "Own profile, attendance and time off only.",
  HR_MANAGER: "Full HR CRUD and time-off approval. No payroll.",
  HR_PAYROLL_USER: "HR plus payruns and payslips. Salary config read-only.",
  HR_PAYROLL_MANAGER: "Full payroll including salary structures and rules.",
  ADMIN: "Everything, plus user management.",
}

export interface UserFormEmployee {
  id: string
  name: string
  workEmail: string | null
  hasUser: boolean
}

export function UserForm({
  employees,
  user,
  isSelf,
}: {
  employees: UserFormEmployee[]
  user?: {
    id: string
    email: string
    roles: Role[]
    active: boolean
    employeeName: string
  }
  isSelf?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})

  const [employeeId, setEmployeeId] = useState("")
  const [email, setEmail] = useState(user?.email ?? "")
  const [password, setPassword] = useState("")
  const [roles, setRoles] = useState<Role[]>(user?.roles ?? [Role.EMPLOYEE])
  const [active, setActive] = useState(user?.active ?? true)

  const editing = Boolean(user)

  const toggleRole = (role: Role) =>
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role],
    )

  const onEmployeeChange = (id: string) => {
    setEmployeeId(id)
    const emp = employees.find((e) => e.id === id)
    if (emp?.workEmail && !email) setEmail(emp.workEmail)
  }

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const result = editing
        ? await updateUser({
            userId: user!.id,
            email,
            password: password || undefined,
            roles,
            active,
          })
        : await createUser({ employeeId, email, password, roles, active })

      if (result.ok) {
        toast.success(editing ? "User updated." : "User created.")
        router.push("/users")
        router.refresh()
        return
      }

      setErrors(result.fieldErrors ?? {})
      toast.error(result.message)
    })
  }

  const available = employees.filter((e) => !e.hasUser)

  return (
    <div className="space-y-5">
      <FormSection title={editing ? "User account" : "Create user"}>
        <FieldGrid>
          {editing ? (
            <Field label="Employee">
              <div className="flex h-9 items-center rounded-md bg-surface-muted px-3 text-sm">
                {user!.employeeName}
              </div>
            </Field>
          ) : (
            <Field
              label="Employee"
              htmlFor="employeeId"
              required
              error={errors.employeeId}
              hint={
                available.length === 0
                  ? "Every employee already has a login."
                  : "One login per employee."
              }
            >
              <Select
                id="employeeId"
                value={employeeId}
                onChange={(e) => onEmployeeChange(e.target.value)}
                error={Boolean(errors.employeeId)}
              >
                <option value="">Select employee</option>
                {available.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}

          <Field label="Work Email" htmlFor="email" required error={errors.email}>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              error={Boolean(errors.email)}
            />
          </Field>

          <Field
            label="Password"
            htmlFor="password"
            required={!editing}
            error={errors.password}
            hint={editing ? "Leave blank to keep the current password." : "Minimum 8 characters."}
          >
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={editing ? "••••••••" : ""}
              error={Boolean(errors.password)}
            />
          </Field>

          <Field
            label="Status"
            error={errors.active}
            hint={isSelf ? "You cannot deactivate your own account." : undefined}
          >
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox
                checked={active}
                disabled={isSelf}
                onChange={(e) => setActive(e.target.checked)}
              />
              Active — inactive users cannot sign in
            </label>
          </Field>
        </FieldGrid>
      </FormSection>

      <FormSection title="Roles">
        {isSelf && (
          <p className="mb-3 rounded-md bg-warning-subtle px-3 py-2 text-xs text-warning">
            You are editing your own account. Roles are locked — ask another administrator to
            change them.
          </p>
        )}
        {errors.roles && <p className="mb-3 text-xs text-danger">{errors.roles}</p>}

        <div className="space-y-2">
          {ROLE_ORDER.map((role) => (
            <label
              key={role}
              className="flex cursor-pointer items-start gap-3 rounded-md border border-border p-3 hover:bg-surface-hover"
            >
              <Checkbox
                className="mt-0.5"
                checked={roles.includes(role)}
                disabled={isSelf}
                onChange={() => toggleRole(role)}
              />
              <span>
                <span className="block text-sm font-medium">{ROLE_LABEL[role]}</span>
                <span className="block text-xs text-muted-foreground">{ROLE_HINT[role]}</span>
              </span>
            </label>
          ))}
        </div>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending} loadingText="Saving…">
          {editing ? "Save Changes" : "Create User"}
        </Button>
        <Button variant="ghost" onClick={() => router.push("/users")} disabled={pending}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
