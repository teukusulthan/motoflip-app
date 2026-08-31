import { type Rupiah, rupiah } from '../money'
import type {
  MarketConfidence,
  MarketModelRef,
  MarketSnapshot,
  MarketSource,
  MarketView,
  Provenance,
} from './types'

export const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

export function provenance(
  overrides: Partial<Provenance> = {},
): Provenance {
  return {
    source: 'MANUAL' as MarketSource,
    retrievedAt: d('2026-08-31'),
    confidence: 'MEDIUM' as MarketConfidence,
    methodology: 'Observasi manual pengguna',
    sampleSize: 12,
    ...overrides,
  }
}

/**
 * `periodStart` is Omit-ed before intersecting: an intersection would narrow
 * it to `Date & string` and reject the ISO strings these tests read best with.
 */
export function snapshot(
  overrides: Omit<Partial<MarketSnapshot>, 'periodStart'> & {
    periodStart: string
  },
): MarketSnapshot {
  const { periodStart, ...rest } = overrides
  return {
    periodStart: d(periodStart),
    demandIndex: 70,
    listingCount: 20,
    medianPrice: rupiah(26_000_000),
    p25Price: rupiah(23_000_000),
    p75Price: rupiah(28_000_000),
    avgDaysToSell: 18,
    provenance: provenance(),
    ...rest,
  }
}

export function ref(overrides: Partial<MarketModelRef> = {}): MarketModelRef {
  return {
    id: 'mm-1',
    brand: 'Yamaha',
    model: 'NMAX',
    variant: null,
    year: 2022,
    ...overrides,
  }
}

export function view(overrides: Partial<MarketView> = {}): MarketView {
  return {
    ref: ref(),
    history: [snapshot({ periodStart: '2026-08-01' })],
    observations: [],
    provenance: provenance(),
    ...overrides,
  }
}

/** A rising demand series: 58 → 63 → 67 → 72 → 81 → 89, per §26's example. */
export function risingHistory(): MarketSnapshot[] {
  const months = ['2026-03-01', '2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01']
  const demand = [58, 63, 67, 72, 81, 89]
  return months.map((periodStart, i) =>
    snapshot({ periodStart, demandIndex: demand[i] as number }),
  )
}

export const money = (value: number): Rupiah => rupiah(value)
