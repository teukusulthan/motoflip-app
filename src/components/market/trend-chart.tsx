import { cn } from '@/lib/utils'

export interface TrendPoint {
  label: string
  value: number | null
  synthetic: boolean
}

/**
 * §26 — demand history as a sparkline-style bar chart.
 *
 * Rendered as inline SVG-free markup so it costs no JavaScript on a mobile
 * connection (§40). Synthetic bars are hatched so a real month is visually
 * distinguishable from an illustrated one at a glance.
 */
export function TrendChart({
  points,
  ariaLabel,
}: {
  points: TrendPoint[]
  ariaLabel: string
}) {
  const values = points
    .map((p) => p.value)
    .filter((v): v is number => v !== null)

  if (values.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-fg-muted">
        Belum ada riwayat permintaan untuk ditampilkan.
      </p>
    )
  }

  const max = Math.max(...values)
  const min = Math.min(...values)
  const span = Math.max(1, max - min)

  return (
    <figure>
      <div
        role="img"
        aria-label={ariaLabel}
        className="flex h-32 items-end gap-1.5"
      >
        {points.map((point, index) => {
          // Scale into 15–100% so even the lowest month stays visible.
          const height =
            point.value === null
              ? 0
              : 15 + ((point.value - min) / span) * 85
          const latest = index === points.length - 1

          return (
            <div
              key={point.label}
              className="flex min-w-0 flex-1 flex-col items-center gap-1.5"
            >
              <span className="tabular text-[10px] font-semibold text-fg-muted">
                {point.value ?? '—'}
              </span>
              <div
                className={cn(
                  'w-full rounded-sm',
                  point.value === null
                    ? 'bg-elevated'
                    : latest
                      ? 'bg-accent'
                      : 'bg-accent/35',
                  point.synthetic && point.value !== null && 'opacity-60',
                )}
                style={{ height: `${height}%` }}
              />
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex gap-1.5">
        {points.map((point) => (
          <span
            key={point.label}
            className="min-w-0 flex-1 truncate text-center text-[10px] text-fg-subtle"
          >
            {point.label}
          </span>
        ))}
      </div>
    </figure>
  )
}
