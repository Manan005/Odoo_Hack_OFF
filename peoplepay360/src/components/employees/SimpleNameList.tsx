"use client"

import { Layers, Pencil, Plus } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { EmptyState } from "@/components/shared/EmptyState"
import { Button } from "@/components/ui/button"
import { Field, Input, Select } from "@/components/ui/field"
import { Surface } from "@/components/ui/surface"
import type { ActionResult } from "@/lib/result"
import { cn } from "@/lib/utils"

export interface SimpleRow {
  id: string
  name: string
  managerId?: string | null
  managerName?: string | null
  /** A live `_count` from the page — never computed here. */
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
  countHrefBase,
  save,
}: {
  rows: SimpleRow[]
  managers?: Array<{ id: string; name: string }>
  entityLabel: string
  /** Prefix for the count chip link, e.g. `/employees?departmentId=` — the row id is appended. */
  countHrefBase?: string
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
        id: editingId && editingId !== "new" ? editingId : undefined,
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

  // Mounted inside `.expander`, which opens from 0fr to 1fr via @starting-style.
  // Fields stack on a phone and sit in one row from `sm` up.
  const editor = (
    <div className="expander">
      <div>
        <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary-subtle/30 p-3 sm:flex-row sm:flex-wrap sm:items-end">
          <Field label="Name" htmlFor="name" error={error ?? undefined} className="sm:min-w-56">
            <Input
              id="name"
              autoFocus
              value={name}
              error={Boolean(error)}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit()
                if (e.key === "Escape") setEditingId(null)
              }}
              placeholder={`${entityLabel} name`}
            />
          </Field>
          {managers && (
            <Field label="Manager" htmlFor="managerId" className="sm:min-w-56">
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
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              className="h-10 sm:h-8"
              onClick={submit}
              loading={pending}
              loadingText="Saving…"
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-10 sm:h-8"
              onClick={() => setEditingId(null)}
              disabled={pending}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )

  const countChip = (row: SimpleRow) => {
    const chip = (
      <span className="inline-flex min-w-7 items-center justify-center rounded-md bg-surface-muted px-1.5 py-0.5 text-xs font-semibold tabular ring-1 ring-inset ring-border/60 transition-colors duration-150 group-hover/count:bg-primary-subtle group-hover/count:text-primary">
        {row.employeeCount}
      </span>
    )
    if (!countHrefBase || row.employeeCount === 0) return chip
    return (
      <Link
        href={`${countHrefBase}${row.id}`}
        className="group/count inline-flex rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
        title={`Open the ${row.employeeCount} employees in ${row.name}`}
      >
        {chip}
      </Link>
    )
  }

  const colSpan = managers ? 4 : 3
  const th = "px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground"

  return (
    <div className="space-y-3">
      {editingId === "new" ? (
        editor
      ) : (
        <Button onClick={startNew} className="h-10 pl-3 sm:h-9">
          <Plus className="h-4 w-4" aria-hidden />
          New {entityLabel.toLowerCase()}
        </Button>
      )}

      <Surface className="overflow-hidden">
        {/*
         * Same shell as DataTable (rules.md §9): the table scrolls inside the
         * Surface below 480px with the Name cell pinned; `@container` is what
         * lets the inline editor size itself to the visible width.
         */}
        <div data-table-scroll className="@container overflow-x-auto overscroll-x-contain">
          <table className="w-full min-w-[480px] border-collapse">
            <thead>
              <tr className="border-b border-border/70 bg-surface-muted">
                <th className={cn(th, "sticky-col sticky left-0 z-[1] bg-surface-muted text-left")}>
                  Name
                </th>
                {managers && <th className={cn(th, "text-left")}>Manager</th>}
                <th className={cn(th, "text-right")}>Employees</th>
                <th className="w-14 sm:w-12" />
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {rows.map((row) =>
                editingId === row.id ? (
                  <tr key={row.id}>
                    {/*
                     * The row is as wide as the scrolling table, so the editor
                     * sits in a sticky sizer that is as wide as the scroller
                     * (`100cqw`, from the wrapper's `@container`) and pins to
                     * its visible edge — a phone edits without scrolling
                     * sideways. It wraps the expander rather than living inside
                     * it because the expander's child is `overflow: hidden`,
                     * which would otherwise become the sticky scrollport.
                     */}
                    <td colSpan={colSpan} className="p-0">
                      <div className="sticky left-0 w-[100cqw] max-w-full p-3">{editor}</div>
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={row.id}
                    className="group h-11 border-b border-border/60 transition-colors duration-100 last:border-0 hover:bg-surface-hover"
                  >
                    <td className="sticky-col sticky left-0 z-[1] bg-surface px-4 py-2.5 text-sm font-medium transition-[background-color,box-shadow] duration-150 group-hover:bg-surface-hover group-hover:shadow-[inset_2px_0_0_0_var(--color-primary)]">
                      {row.name}
                    </td>
                    {managers && (
                      <td className="px-4 py-2.5 text-sm text-muted-foreground">
                        {row.managerName ?? "—"}
                      </td>
                    )}
                    <td className="px-4 py-2.5 text-right text-sm tabular">{countChip(row)}</td>
                    <td className="px-2 py-1 text-right sm:px-4 sm:py-2.5">
                      <button
                        type="button"
                        aria-label={`Edit ${row.name}`}
                        onClick={() => startEdit(row)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-md text-muted-foreground opacity-60 transition-[opacity,background-color,color,transform] duration-150 hover:bg-primary-subtle hover:text-primary active:scale-90 group-hover:opacity-100 focus-visible:opacity-100 sm:h-8 sm:w-8"
                      >
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
        {/* Outside the scroller so it centres on the viewport, not on a 480px table. */}
        {rows.length === 0 && (
          <EmptyState
            icon={Layers}
            title={`No ${entityLabel.toLowerCase()}s yet`}
            description={`Add the first ${entityLabel.toLowerCase()} — it appears on employee records as soon as it is saved.`}
            action={
              editingId !== "new" ? (
                <Button size="sm" variant="soft" className="h-10 sm:h-8" onClick={startNew}>
                  <Plus className="h-3.5 w-3.5" aria-hidden />
                  New {entityLabel.toLowerCase()}
                </Button>
              ) : undefined
            }
          />
        )}
      </Surface>
    </div>
  )
}
