'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { Undo2 } from 'lucide-react'
import { voidEntry } from '@/app/actions/ledger'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}

/**
 * §38 — correct a transaction without mutating history.
 *
 * The original entry is kept and marked void, so the record still shows what
 * was entered and when it was reversed. Re-entering the correct figure is a
 * separate, deliberate step.
 */
export function VoidEntryButton({
  entryId,
  label,
}: {
  entryId: string
  label: string
}) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useFormState(voidEntry, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  React.useEffect(() => {
    if (!submitted.current || state.error) return
    submitted.current = false
    setOpen(false)
    toast.success('Transaksi dibatalkan.')
    router.refresh()
  }, [state, router])

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          aria-label={`Batalkan transaksi ${label}`}
          className="flex size-11 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-elevated hover:text-danger"
        >
          <Undo2 className="size-4" aria-hidden />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto w-full max-w-app px-4 pb-8 pt-3">
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="text-base font-semibold text-fg">
              Batalkan Transaksi
            </Drawer.Title>
            <Drawer.Description className="mb-4 text-sm leading-relaxed text-fg-muted">
              {label} akan ditandai dibatalkan dan berhenti dihitung. Catatannya
              tetap tersimpan agar riwayat keuangan Anda dapat diaudit.
            </Drawer.Description>

            <form
              action={formAction}
              onSubmit={() => {
                submitted.current = true
              }}
              className="space-y-4"
            >
              <input type="hidden" name="entryId" value={entryId} />
              <div className="space-y-1.5">
                <Label htmlFor={`void-reason-${entryId}`}>Alasan</Label>
                <Input
                  id={`void-reason-${entryId}`}
                  name="reason"
                  placeholder="Salah nominal, dobel input…"
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
    <Button type="submit" variant="danger" size="full" disabled={pending}>
      {pending ? 'Membatalkan…' : 'Batalkan Transaksi'}
    </Button>
  )
}
