'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useFormState, useFormStatus } from 'react-dom'
import { toast } from 'sonner'
import { Star } from 'lucide-react'
import { toggleWatchlist } from '@/app/actions/market'
import type { ActionState } from '@/lib/validation'
import { cn } from '@/lib/utils'

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
