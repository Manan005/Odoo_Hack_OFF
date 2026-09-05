"use client"

import { Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/field"
import { Surface } from "@/components/ui/surface"
import type { ActionResult } from "@/lib/result"

export interface SimpleRow {
  id: string
  name: string
  managerId?: string | null
  managerName?: string | null
  employeeCount: number
}

/**
 * Departments and Job Positions are thin config lists — inline add/edit rather
 * than a dedicated form route (phases.md P2 budgets 20 minutes for both).
 */
export function SimpleNameList({
  rows,
  managers,
  entityLabel,
  save,
}: {
  rows: SimpleRow[]
  managers?: Array<{ id: string; name: string }>
  entityLabel: string
  save: (input: {
    id?: string
    name: string
    managerId?: string | null
  }) => Promise<ActionResult<{ id: string }>>
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState("")
  const [managerId, setManagerId] = useState("")
  const [error, setError] = useState<string | null>(null)

  const startNew = () => {
    setEditingId("new")
    setName("")
    setManagerId("")
    setError(null)
  }

  const startEdit = (row: SimpleRow) => {
    setEditingId(row.id)
    setName(row.name)
    setManagerId(row.managerId ?? "")
    setError(null)
  }

  const submit = () => {
    setError(null)
    startTransition(async () => {
      const result = await save({
        id: editingId === "new" ? undefined : editingId!,
        name,
        ...(managers ? { managerId: managerId || null } : {}),
      })
      if (result.ok) {
        toast.success(`${entityLabel} saved.`)
        setEditingId(null)
        router.refresh()
        return
      }
      setError(result.fieldErrors?.name ?? result.message)
      toast.error(result.message)
    })
  }

  const editor = (
    <div className="flex origin-top animate-scale-in flex-wrap items-end gap-3 rounded-xl border border-primary/30 bg-primary-subtle/30 p-3">
      <Field label="Name" htmlFor="name" error={error ?? undefined} className="min-w-56">
        <Input
          id="name"
          autoFocus
          value={name}
          error={Boolean(error)}
          onChange={(e) => setName(e.target.value)}
          placeholder={`${entityLabel} name`}
        />
      </Field>
      {managers && (
        <Field label="Manager" htmlFor="managerId" className="min-w-56">
          <Select
            id="managerId"
            value={managerId}
            onChange={(e) => setManagerId(e.target.value)}
          >
            <option value="">—</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </Select>
        </Field>
      )}
      <Button size="sm" onClick={submit} loading={pending} loadingText="Saving…">
        Save
      </Button>
      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} disabled={pending}>
        Cancel
      </Button>
    </div>
  )

  return (
    <div className="space-y-3">
      {editingId === "new" ? (
        editor
      ) : (
        <Button onClick={startNew} className="pl-3">
          <Plus className="h-4 w-4" aria-hidden />
          New {entityLabel.toLowerCase()}
        </Button>
      )}

      <Surface className="overflow-hidden">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-border/70 bg-surface-muted/60">
              <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Name
              </th>
              {managers && (
                <th className="px-4 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Manager
                </th>
              )}
              <th className="px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Employees
              </th>
              <th className="w-12" />
            </tr>
          </thead>
          <tbody className="stagger-rows">
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={managers ? 4 : 3}
                  className="px-4 py-8 text-center text-sm text-muted-foreground"
                >
                  No {entityLabel.toLowerCase()}s yet.
                </td>
              </tr>
            )}
            {rows.map((row) =>
              editingId === row.id ? (
                <tr key={row.id}>
                  <td colSpan={managers ? 4 : 3} className="p-3">
                    {editor}
                  </td>
                </tr>
              ) : (
                <tr
                  key={row.id}
                  className="group h-11 border-b border-border/60 transition-colors duration-100 last:border-0 hover:bg-surface-hover/70"
                >
                  <td className="px-4 py-2.5 text-sm font-medium transition-shadow duration-150 group-hover:shadow-[inset_2px_0_0_0_var(--color-primary)]">
                    {row.name}
                  </td>
                  {managers && (
                    <td className="px-4 py-2.5 text-sm text-muted-foreground">
                      {row.managerName ?? "—"}
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right text-sm tabular">
                    <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-semibold">
                      {row.employeeCount}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button
                      type="button"
                      aria-label={`Edit ${row.name}`}
                      onClick={() => startEdit(row)}
                      className="rounded-md p-1.5 text-muted-foreground opacity-60 transition-[opacity,background-color,color,transform] duration-150 hover:bg-primary-subtle hover:text-primary active:scale-90 group-hover:opacity-100 focus-visible:opacity-100"
                    >
                      <Pencil className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </td>
                </tr>
              ),
            )}
          </tbody>
        </table>
      </Surface>
    </div>
  )
}
