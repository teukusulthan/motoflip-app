'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { AlertCircle, BadgeCheck } from 'lucide-react'
import { markSold } from '@/app/actions/motorcycles'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MoneyInput } from '@/components/motoflip/money-input'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}
const today = new Date().toISOString().slice(0, 10)

/**
 * Workflow 4 (§34) — mark sold.
 *
 * Profit, ROI, holding period and the cashflow impact are all derived from the
 * sale entry this writes, so the user only supplies price, date and account.
 */
export function SellPanel({
  motorcycleId,
  accounts,
  suggestedPrice,
}: {
  motorcycleId: string
  accounts: { id: string; name: string }[]
  suggestedPrice: string
}) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useFormState(markSold, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (!submitted.current) return
    if (state.error) return
    setOpen(false)
    submitted.current = false
    toast.success('Motor ditandai terjual.')
    router.refresh()
  }, [state, router])

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <Button variant="primary">
          <BadgeCheck className="size-4" aria-hidden />
          Tandai Terjual
        </Button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto w-full max-w-app px-4 pb-8 pt-3">
            <div
              aria-hidden
              className="mx-auto mb-4 h-1 w-10 rounded-full bg-border"
            />
            <Drawer.Title className="text-base font-semibold text-fg">
              Tandai Terjual
            </Drawer.Title>
            <Drawer.Description className="mb-4 text-sm text-fg-muted">
              Laba, ROI, dan lama simpan dihitung otomatis.
            </Drawer.Description>

            <form
              action={formAction}
              onSubmit={() => {
                submitted.current = true
              }}
              className="space-y-4"
            >
              <input type="hidden" name="motorcycleId" value={motorcycleId} />

              {state.error && (
                <div
                  role="alert"
                  className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-muted px-3 py-2.5 text-sm text-danger"
                >
                  <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
                  <span>{state.error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="sale-amount">Harga Jual</Label>
                <MoneyInput
                  id="sale-amount"
                  name="amount"
                  defaultValue={suggestedPrice}
                  quickAdd={false}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="sale-date">Tanggal Jual</Label>
                  <Input
                    id="sale-date"
                    name="saleDate"
                    type="date"
                    defaultValue={today}
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sale-account">Masuk ke</Label>
                  <Select id="sale-account" name="accountId" required>
                    {accounts.map((account) => (
                      <option key={account.id} value={account.id}>
                        {account.name}
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sale-note">Catatan</Label>
                <Input
                  id="sale-note"
                  name="note"
                  placeholder="Nama pembeli, cara bayar…"
                />
              </div>

              <SubmitButton />
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? 'Menyimpan…' : 'Konfirmasi Penjualan'}
    </Button>
  )
}
