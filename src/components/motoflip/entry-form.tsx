'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MoneyInput } from '@/components/motoflip/money-input'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}
const today = new Date().toISOString().slice(0, 10)

export interface EntryFormOption {
  id: string
  label: string
  group?: string
}

/**
 * Shared expense/income entry form — §11.
 *
 * Field order follows how the user actually thinks at a workshop counter:
 * amount first (it is what they are looking at), then what it was for, then the
 * bookkeeping details which all have sane defaults.
 */
export function EntryForm({
  action,
  categories,
  motorcycles,
  accounts,
  vendors,
  defaultMotorcycleId,
  submitLabel,
  successMessage,
  redirectTo,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>
  categories: EntryFormOption[]
  motorcycles: EntryFormOption[]
  accounts: EntryFormOption[]
  vendors: EntryFormOption[]
  defaultMotorcycleId?: string
  submitLabel: string
  successMessage: string
  redirectTo: string
}) {
  const [state, formAction] = useFormState(action, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (!submitted.current) return
    if (state.error || state.fieldErrors) return
    submitted.current = false
    toast.success(successMessage)
    router.push(redirectTo)
  }, [state, router, successMessage, redirectTo])

  const grouped = React.useMemo(() => {
    const map = new Map<string, EntryFormOption[]>()
    for (const category of categories) {
      const key = category.group ?? 'Lainnya'
      const list = map.get(key)
      if (list) list.push(category)
      else map.set(key, [category])
    }
    return [...map.entries()]
  }, [categories])

  const err = (field: string) => state.fieldErrors?.[field]

  return (
    <form
      action={formAction}
      onSubmit={() => {
        submitted.current = true
      }}
      className="space-y-4 pb-28"
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
          <div className="space-y-1.5">
            <Label htmlFor="amount">Jumlah</Label>
            <MoneyInput id="amount" name="amount" required />
            {err('amount') && (
              <p role="alert" className="text-xs font-medium text-danger">
                {err('amount')}
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="categoryId">Kategori</Label>
            <Select id="categoryId" name="categoryId" required defaultValue="">
              <option value="" disabled>
                Pilih kategori…
              </option>
              {grouped.map(([group, items]) => (
                <optgroup key={group} label={group}>
                  {items.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="motorcycleId">Motor</Label>
            <Select
              id="motorcycleId"
              name="motorcycleId"
              defaultValue={defaultMotorcycleId ?? ''}
            >
              <option value="">— Biaya usaha (bukan per motor) —</option>
              {motorcycles.map((bike) => (
                <option key={bike.id} value={bike.id}>
                  {bike.label}
                </option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="occurredAt">Tanggal</Label>
              <Input
                id="occurredAt"
                name="occurredAt"
                type="date"
                defaultValue={today}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="accountId">Akun Kas</Label>
              <Select id="accountId" name="accountId" required>
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="vendorId">Vendor / Bengkel</Label>
            <Select id="vendorId" name="vendorId" defaultValue="">
              <option value="">— Tidak ada —</option>
              {vendors.map((vendor) => (
                <option key={vendor.id} value={vendor.id}>
                  {vendor.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="note">Catatan</Label>
            <Input
              id="note"
              name="note"
              placeholder="Servis CVT, ganti roller…"
            />
          </div>
        </CardContent>
      </Card>

      <StickySubmit label={submitLabel} />
    </form>
  )
}

function StickySubmit({ label }: { label: string }) {
  const { pending } = useFormStatus()
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-4 lg:rounded-lg lg:border">
      <div
        className="mx-auto max-w-app lg:max-w-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        <Button type="submit" size="full" disabled={pending}>
          {pending ? 'Menyimpan…' : label}
        </Button>
      </div>
    </div>
  )
}
