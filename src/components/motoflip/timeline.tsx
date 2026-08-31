import {
  Bike,
  Camera,
  DollarSign,
  FileText,
  Flag,
  Wrench,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { formatDayMonth, formatRupiah } from '@/lib/format'

export interface TimelineEvent {
  id: string
  date: Date
  kind: 'PURCHASE' | 'SALE' | 'EXPENSE' | 'STATUS' | 'PHOTO' | 'DOCUMENT'
  title: string
  detail?: string | null
  amount?: bigint | null
  voided?: boolean
}

const ICONS: Record<TimelineEvent['kind'], LucideIcon> = {
  PURCHASE: Bike,
  SALE: DollarSign,
  EXPENSE: Wrench,
  STATUS: Flag,
  PHOTO: Camera,
  DOCUMENT: FileText,
}

const TONES: Record<TimelineEvent['kind'], string> = {
  PURCHASE: 'bg-info-muted text-info',
  SALE: 'bg-success-muted text-success',
  EXPENSE: 'bg-elevated text-fg-muted',
  STATUS: 'bg-accent/12 text-accent',
  PHOTO: 'bg-elevated text-fg-muted',
  DOCUMENT: 'bg-elevated text-fg-muted',
}

/**
 * §13 — generated from real application events, never duplicated data.
 * The caller merges ledger entries, status changes, photos and documents.
 */
export function Timeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-fg-muted">
        Belum ada aktivitas tercatat untuk motor ini.
      </p>
    )
  }

  return (
    <ol className="relative space-y-0">
      {events.map((event, index) => {
        const Icon = ICONS[event.kind]
        const last = index === events.length - 1

        return (
          <li key={event.id} className="relative flex gap-3 pb-5">
            {!last && (
              <span
                aria-hidden
                className="absolute left-[15px] top-9 h-[calc(100%-1.5rem)] w-px bg-border"
              />
            )}

            <span
              className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full ${TONES[event.kind]}`}
            >
              <Icon className="size-3.5" aria-hidden />
            </span>

            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <p
                  className={`text-sm font-semibold ${event.voided ? 'text-fg-subtle line-through' : 'text-fg'}`}
                >
                  {event.title}
                </p>
                {event.amount !== null && event.amount !== undefined && (
                  <span
                    className={`tabular shrink-0 text-metric-sm ${
                      event.voided
                        ? 'text-fg-subtle line-through'
                        : event.kind === 'SALE'
                          ? 'text-success'
                          : 'text-fg'
                    }`}
                  >
                    {formatRupiah(event.amount)}
                  </span>
                )}
              </div>
              <p className="mt-0.5 text-xs text-fg-subtle">
                {formatDayMonth(event.date)}
                {event.detail ? ` · ${event.detail}` : ''}
                {event.voided ? ' · dibatalkan' : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
