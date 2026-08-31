'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { Drawer } from 'vaul'
import { toast } from 'sonner'
import { Plus } from 'lucide-react'
import { trackModel } from '@/app/actions/market'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { ActionState } from '@/lib/validation'

const initialState: ActionState = {}

/** §25 — a tracked model is always a model AND a year. */
export function TrackModelPanel({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useFormState(trackModel, initialState)
  const router = useRouter()
  const submitted = React.useRef(false)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  React.useEffect(() => {
    if (!submitted.current || state.error) return
    submitted.current = false
    setOpen(false)
    toast.success('Model ditambahkan ke pantauan.')
    router.refresh()
  }, [state, router])

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        {compact ? (
          <Button size="icon" aria-label="Pantau model baru">
            <Plus className="size-5" aria-hidden />
          </Button>
        ) : (
          <Button size="full">
            <Plus className="size-4" aria-hidden />
            Pantau Model
          </Button>
        )}
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto w-full max-w-app px-4 pb-8 pt-3">
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="text-base font-semibold text-fg">
              Pantau Model
            </Drawer.Title>
            <Drawer.Description className="mb-4 text-sm text-fg-muted">
              Tahun produksi dipisahkan — NMAX 2021 dan NMAX 2022 punya ekonomi
              yang berbeda.
            </Drawer.Description>

            <form
              action={formAction}
              onSubmit={() => {
                submitted.current = true
              }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="track-brand">Merek</Label>
                  <Input id="track-brand" name="brand" required placeholder="Yamaha" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="track-model">Model</Label>
                  <Input id="track-model" name="model" required placeholder="NMAX" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="track-year">Tahun</Label>
                  <Input
                    id="track-year"
                    name="year"
                    type="number"
                    inputMode="numeric"
                    required
                    placeholder="2022"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="track-variant">Varian</Label>
                  <Input id="track-variant" name="variant" placeholder="ABS" />
                </div>
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
      {pending ? 'Menyimpan…' : 'Pantau Model'}
    </Button>
  )
}
