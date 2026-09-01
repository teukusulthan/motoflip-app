'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Star, Trash2 } from 'lucide-react'
import { toggleWatchlist, untrackModel } from '@/app/actions/market'
import type { ActionState } from '@/lib/validation'
import { cn } from '@/lib/utils'
import { Drawer } from 'vaul'
import { Button } from '@/components/ui/button'

const initialState: ActionState = {}

/** §27 — follow or unfollow a model. */
export function WatchToggle({
  marketModelId,
  watched,
}: {
  marketModelId: string
  watched: boolean
}) {
  const [state, formAction] = useFormState(toggleWatchlist, initialState)
  const router = useRouter()

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
    else if (state !== initialState) router.refresh()
  }, [state, router])

  return (
    <form action={formAction}>
      <input type="hidden" name="marketModelId" value={marketModelId} />
      <ToggleButton watched={watched} />
    </form>
  )
}

function ToggleButton({ watched }: { watched: boolean }) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      aria-pressed={watched}
      aria-label={watched ? 'Hapus dari watchlist' : 'Tambahkan ke watchlist'}
      className={cn(
        'flex size-11 items-center justify-center rounded-md border transition-colors disabled:opacity-50',
        watched
          ? 'border-accent/40 bg-accent/12 text-accent'
          : 'border-border bg-surface text-fg-muted hover:text-fg',
      )}
    >
      <Star className={cn('size-5', watched && 'fill-current')} aria-hidden />
    </button>
  )
}


/**
 * Stop tracking a model entirely.
 *
 * This removes user-created tracking data (the model, its watchlist entry and
 * its observations) — not financial history — so a hard delete is appropriate,
 * behind a confirmation because the observations are real work.
 */
export function UntrackButton({
  marketModelId,
  label,
  observationCount,
}: {
  marketModelId: string
  label: string
  observationCount: number
}) {
  const [open, setOpen] = React.useState(false)
  const [state, formAction] = useFormState(untrackModel, initialState)

  React.useEffect(() => {
    if (state.error) toast.error(state.error)
  }, [state])

  return (
    <Drawer.Root open={open} onOpenChange={setOpen}>
      <Drawer.Trigger asChild>
        <button
          type="button"
          aria-label={`Berhenti memantau ${label}`}
          className="flex size-11 items-center justify-center rounded-md border border-border bg-surface text-fg-subtle transition-colors hover:text-danger"
        >
          <Trash2 className="size-4" aria-hidden />
        </button>
      </Drawer.Trigger>

      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
        <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 rounded-t-2xl border-t border-border bg-surface outline-none">
          <div className="mx-auto w-full max-w-app px-4 pb-8 pt-3">
            <div aria-hidden className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" />
            <Drawer.Title className="text-base font-semibold text-fg">
              Berhenti Memantau
            </Drawer.Title>
            <Drawer.Description className="mb-4 text-sm leading-relaxed text-fg-muted">
              {label} akan dihapus dari pantauan
              {observationCount > 0
                ? `, beserta ${observationCount} observasi pasar yang Anda catat. Ini tidak dapat dibatalkan.`
                : '. Riwayat flipping Anda tidak terpengaruh.'}
            </Drawer.Description>

            <form action={formAction}>
              <input type="hidden" name="marketModelId" value={marketModelId} />
              <UntrackSubmit />
            </form>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  )
}

function UntrackSubmit() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" variant="danger" size="full" disabled={pending}>
      {pending ? 'Menghapus…' : 'Berhenti Memantau'}
    </Button>
  )
}
