import Link from 'next/link'
import type { MotorcycleStatus } from '@prisma/client'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatPercent,
  formatRupiah,
  formatRupiahCompact,
} from '@/lib/format'
import { StatusBadge } from './status-badge'

export interface MotorcycleCardData {
  id: string
  title: string
  subtitle: string
  status: MotorcycleStatus
  totalCost: bigint
  headlineLabel: string
  headlineValue: bigint | null
  roiBps: number | null
  days: number | null
}

/**
 * Garage list item.
 *
 * One card answers: what is it, how much is in it, what will it return, and how
 * long has it been sitting. Everything else is on the detail screen (§32
 * progressive disclosure).
 */
export function MotorcycleCard({ bike }: { bike: MotorcycleCardData }) {
  const positive = bike.headlineValue !== null && bike.headlineValue >= 0n

  return (
    <li>
      <Link
        href={`/garasi/${bike.id}`}
        className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/40"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-fg">
              {bike.title}
            </h3>
            <p className="mt-0.5 truncate text-xs text-fg-muted">
              {bike.subtitle}
            </p>
          </div>
          <StatusBadge status={bike.status} />
        </div>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              Total Biaya
            </p>
            <p className="tabular mt-0.5 text-metric-sm text-fg">
              {formatRupiah(bike.totalCost)}
            </p>
          </div>

          <div className="min-w-0 text-right">
            <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
              {bike.headlineLabel}
            </p>
            <p
              className={cn(
                'tabular mt-0.5 text-metric-sm',
                bike.headlineValue === null
                  ? 'text-fg-subtle'
                  : positive
                    ? 'text-success'
                    : 'text-danger',
              )}
            >
              {bike.headlineValue === null
                ? '—'
                : formatRupiahCompact(bike.headlineValue)}
              {bike.roiBps !== null && (
                <span className="ml-1.5 text-xs font-medium text-fg-muted">
                  {formatPercent(bike.roiBps)}
                </span>
              )}
            </p>
          </div>
        </div>

        {bike.days !== null && (
          <p className="mt-3 flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-fg-subtle">
            <Clock className="size-3" aria-hidden />
            {bike.days} hari
          </p>
        )}
      </Link>
    </li>
  )
}
