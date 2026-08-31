import { cn } from '@/lib/utils'

export type StatTone = 'default' | 'positive' | 'negative' | 'accent' | 'muted'

const toneClass: Record<StatTone, string> = {
  default: 'text-fg',
  positive: 'text-success',
  negative: 'text-danger',
  accent: 'text-accent',
  muted: 'text-fg-muted',
}

export interface StatProps {
  label: string
  value: string
  hint?: string
  tone?: StatTone
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClass = {
  sm: 'text-metric-sm',
  md: 'text-metric',
  lg: 'text-metric-lg',
} as const

/** A single labelled figure. The building block of every summary screen. */
export function Stat({
  label,
  value,
  hint,
  tone = 'default',
  size = 'md',
  className,
}: StatProps) {
  return (
    <div className={cn('min-w-0', className)}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </p>
      <p className={cn('tabular mt-1 truncate', sizeClass[size], toneClass[tone])}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-fg-muted">{hint}</p>}
    </div>
  )
}

/** A label/value pair on one line — the mobile answer to a table row (§44). */
export function StatRow({
  label,
  value,
  tone = 'default',
  emphasis = false,
}: {
  label: string
  value: string
  tone?: StatTone
  emphasis?: boolean
}) {
  return (
    <div
      className={cn(
        'flex items-baseline justify-between gap-4 py-2.5',
        emphasis && 'border-t border-border pt-3',
      )}
    >
      <span
        className={cn(
          'text-sm',
          emphasis ? 'font-semibold text-fg' : 'text-fg-muted',
        )}
      >
        {label}
      </span>
      <span
        className={cn(
          'tabular shrink-0 text-right',
          emphasis ? 'text-metric' : 'text-metric-sm',
          toneClass[tone],
        )}
      >
        {value}
      </span>
    </div>
  )
}
