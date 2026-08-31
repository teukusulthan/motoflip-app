import 'server-only'
import { type Rupiah, rupiah } from '@/domain/money'
import type { MarketObservation, MarketSnapshot } from '@/domain/market/types'

/**
 * Real market data, derived from listings the user recorded themselves.
 *
 * This is not synthetic. A flipper looks at the market every day, and an
 * asking price they actually saw is genuine evidence — the only genuine
 * evidence this application has until an external provider is connected.
 *
 * Confidence scales with sample size, because three listings is an anecdote
 * and thirty is a distribution.
 */

/** Linear-interpolated percentile over a sorted numeric series. */
export function percentile(sorted: readonly bigint[], p: number): Rupiah | null {
  if (sorted.length === 0) return null
  if (sorted.length === 1) return rupiah(sorted[0] as bigint)

  const position = (sorted.length - 1) * p
  const lower = Math.floor(position)
  const upper = Math.ceil(position)

  const low = sorted[lower]
  const high = sorted[upper]
  if (low === undefined || high === undefined) return null
  if (lower === upper) return rupiah(low)

  // Interpolate in integer space; no float ever touches a rupiah value.
  const weight = BigInt(Math.round((position - lower) * 1000))
  return rupiah(low + ((high - low) * weight) / 1000n)
}

function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

function confidenceFor(sampleSize: number) {
  if (sampleSize >= 12) return 'HIGH' as const
  if (sampleSize >= 6) return 'MEDIUM' as const
  return 'LOW' as const
}

/**
 * Aggregate observations into monthly snapshots.
 *
 * A month with no observations produces no snapshot — a gap in the record is
 * reported as a gap, never interpolated into a number that was never observed.
 */
export function snapshotsFromObservations(
  observations: readonly MarketObservation[],
  now: Date = new Date(),
): MarketSnapshot[] {
  if (observations.length === 0) return []

  const byMonth = new Map<number, MarketObservation[]>()
  for (const observation of observations) {
    const key = startOfMonthUtc(observation.observedAt).getTime()
    const bucket = byMonth.get(key)
    if (bucket) bucket.push(observation)
    else byMonth.set(key, [observation])
  }

  const months = [...byMonth.keys()].sort((a, b) => a - b)
  const counts = months.map((m) => (byMonth.get(m) as MarketObservation[]).length)
  const maxCount = Math.max(...counts)

  return months.map((month) => {
    const group = byMonth.get(month) as MarketObservation[]
    const prices = group.map((o) => o.askingPrice as bigint).sort((a, b) =>
      a < b ? -1 : a > b ? 1 : 0,
    )

    const ages = group
      .map((o) => o.listingAgeDays)
      .filter((v): v is number => v !== null)

    return {
      periodStart: new Date(month),
      /**
       * Demand is expressed relative to the busiest month observed. This is an
       * honest proxy — it measures how much the user saw, not true market
       * demand — and the methodology string says exactly that.
       */
      demandIndex:
        maxCount === 0 ? null : Math.round((group.length / maxCount) * 100),
      listingCount: group.length,
      medianPrice: percentile(prices, 0.5),
      p25Price: percentile(prices, 0.25),
      p75Price: percentile(prices, 0.75),
      avgDaysToSell:
        ages.length === 0
          ? null
          : Math.round(ages.reduce((a, b) => a + b, 0) / ages.length),
      provenance: {
        source: 'MANUAL',
        retrievedAt: now,
        confidence: confidenceFor(group.length),
        methodology:
          'Dihitung dari listing yang Anda catat sendiri. Indeks permintaan adalah proksi relatif terhadap bulan tersibuk, bukan ukuran permintaan pasar sebenarnya.',
        sampleSize: group.length,
      },
    }
  })
}
