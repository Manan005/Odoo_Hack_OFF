"use client"

import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { toast } from "sonner"
import { saveStructure } from "@/actions/salary.actions"
import { FieldGrid, FormSection } from "@/components/shared/FormHeader"
import { Button } from "@/components/ui/button"
import { Checkbox, Field, Input, Textarea } from "@/components/ui/field"

export interface StructureFormValues {
  id?: string
  name: string
  active: boolean
  note: string
}

export function StructureForm({ initial }: { initial: StructureFormValues }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [v, setV] = useState<StructureFormValues>(initial)

  const submit = () => {
    setErrors({})
    startTransition(async () => {
      const result = await saveStructure(v)
      if (result.ok) {
        toast.success("Structure saved.")
        router.push(`/payroll/structures/${result.data.id}`)
        router.refresh()
        return
      }
      setErrors(result.fieldErrors ?? {})
      toast.error(result.message)
    })
  }

  return (
    <div className="space-y-5">
      <FormSection title="Structure">
        <FieldGrid>
          <Field label="Structure Name" htmlFor="name" required error={errors.name}>
            <Input
              id="name"
              value={v.name}
              placeholder="Regular Salary"
              error={Boolean(errors.name)}
              onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))}
            />
          </Field>
          <Field label="Status">
            <label className="flex h-9 items-center gap-2 text-sm">
              <Checkbox
                checked={v.active}
                onChange={(e) => setV((p) => ({ ...p, active: e.target.checked }))}
              />
              Active
            </label>
          </Field>
          <Field label="Note" htmlFor="note" className="md:col-span-2">
            <Textarea
              id="note"
              rows={2}
              value={v.note}
              placeholder="Standard full-time structure."
              onChange={(e) => setV((p) => ({ ...p, note: e.target.value }))}
            />
          </Field>
        </FieldGrid>
      </FormSection>

      <div className="flex items-center gap-2">
        <Button onClick={submit} loading={pending} loadingText="Saving…">
          {v.id ? "Save Changes" : "Create Structure"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => router.push("/payroll/structures")}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </div>
  )
}
