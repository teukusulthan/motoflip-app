'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { AlertCircle, Info } from 'lucide-react'
import { createTransfer } from '@/app/actions/ledger'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { MoneyInput } from '@/components/motoflip/money-input'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}
const today = new Date().toISOString().slice(0, 10)

/** §15 — a transfer moves money between your own accounts. It is not a cost. */
export function TransferForm({
  accounts,
}: {
  accounts: { id: string; label: string }[]
}) {
  const [state, formAction] = useFormState(createTransfer, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (!submitted.current || state.error) return
    submitted.current = false
    toast.success('Transfer tersimpan.')
    router.push('/lainnya')
  }, [state, router])

  if (accounts.length < 2) {
    return (
      <Card className="border-dashed">
        <CardContent className="py-8 text-center">
          <p className="text-sm text-fg-muted">
            Transfer memerlukan minimal dua akun kas aktif.
          </p>
          <Button asChild variant="secondary" className="mt-4">
            <a href="/lainnya/akun-kas">Kelola Akun Kas</a>
          </Button>
        </CardContent>
      </Card>
    )
  }

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

      <Card className="border-dashed">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
          <p className="text-xs leading-relaxed text-fg-muted">
            Transfer tidak dihitung sebagai pemasukan maupun pengeluaran. Total
            kas Anda tidak berubah — hanya sebarannya antar akun.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="transfer-amount">Jumlah</Label>
            <MoneyInput id="transfer-amount" name="amount" required />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-from">Dari Akun</Label>
            <Select id="transfer-from" name="accountId" required>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-to">Ke Akun</Label>
            <Select
              id="transfer-to"
              name="toAccountId"
              required
              defaultValue={accounts[1]?.id}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-date">Tanggal</Label>
            <Input
              id="transfer-date"
              name="occurredAt"
              type="date"
              defaultValue={today}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transfer-note">Catatan</Label>
            <Input id="transfer-note" name="note" placeholder="Setor tunai ke bank…" />
          </div>
        </CardContent>
      </Card>

      <SubmitButton />
    </form>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 px-4 py-3 backdrop-blur lg:sticky lg:bottom-4 lg:rounded-lg lg:border">
      <div
        className="mx-auto max-w-app lg:max-w-none"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4rem)' }}
      >
        <Button type="submit" size="full" disabled={pending}>
          {pending ? 'Menyimpan…' : 'Simpan Transfer'}
        </Button>
      </div>
    </div>
  )
}
