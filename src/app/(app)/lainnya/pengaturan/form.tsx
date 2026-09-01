'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { updateSettings } from '@/app/actions/settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}

/** §18 — the ageing threshold and warning levels are configurable. */
export function SettingsForm({
  defaults,
}: {
  defaults: {
    agingWarnDays: number
    agingCriticalDays: number
    repairOverrunPercent: number
    lowMarginPercent: number
  }
}) {
  const [state, formAction] = useFormState(updateSettings, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (!submitted.current || state.error || state.fieldErrors) return
    submitted.current = false
    toast.success('Pengaturan tersimpan.')
    router.refresh()
  }, [state, router])

  const err = (field: string) => state.fieldErrors?.[field]

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submitted.current = true
      }}
      className="space-y-4"
    >
      {state.error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-muted px-3 py-2.5 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{state.error}</span>
        </div>
      )}

      <Card>
        <CardContent className="space-y-4">
          <Field
            label="Peringatan umur inventori (hari)"
            htmlFor="agingWarnDays"
            hint="Motor yang tersimpan lebih lama dari ini muncul di daftar perhatian."
            error={err('agingWarnDays')}
          >
            <Input
              id="agingWarnDays"
              name="agingWarnDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              required
              defaultValue={defaults.agingWarnDays}
            />
          </Field>

          <Field
            label="Kritis umur inventori (hari)"
            htmlFor="agingCriticalDays"
            hint="Melewati ambang ini, peringatan berubah menjadi merah."
            error={err('agingCriticalDays')}
          >
            <Input
              id="agingCriticalDays"
              name="agingCriticalDays"
              type="number"
              inputMode="numeric"
              min={1}
              max={730}
              required
              defaultValue={defaults.agingCriticalDays}
            />
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <Field
            label="Toleransi kelebihan biaya perbaikan (%)"
            htmlFor="repairOverrunPercent"
            hint="Peringatan muncul bila realisasi perbaikan melebihi anggaran sebesar ini."
            error={err('repairOverrunPercent')}
          >
            <Input
              id="repairOverrunPercent"
              name="repairOverrunPercent"
              type="number"
              inputMode="numeric"
              min={0}
              max={500}
              required
              defaultValue={defaults.repairOverrunPercent}
            />
          </Field>

          <Field
            label="Ambang margin tipis (%)"
            htmlFor="lowMarginPercent"
            hint="Perkiraan ROI di bawah angka ini ditandai sebagai margin tipis."
            error={err('lowMarginPercent')}
          >
            <Input
              id="lowMarginPercent"
              name="lowMarginPercent"
              type="number"
              inputMode="numeric"
              min={0}
              max={100}
              required
              defaultValue={defaults.lowMarginPercent}
            />
          </Field>
        </CardContent>
      </Card>

      <SubmitButton />
    </form>
  )
}

function Field({
  label,
  htmlFor,
  hint,
  error,
  children,
}: {
  label: string
  htmlFor: string
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-fg-subtle">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      )}
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Simpan Pengaturan'}
    </Button>
  )
}
