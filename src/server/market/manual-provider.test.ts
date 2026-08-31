import { describe, expect, it } from 'vitest'
import { rupiah } from '@/domain/money'
import type { MarketObservation } from '@/domain/market/types'
import { percentile, snapshotsFromObservations } from './manual-provider'

const d = (iso: string) => new Date(`${iso}T00:00:00.000Z`)

let n = 0
const obs = (
  price: number,
  on: string,
  listingAgeDays: number | null = null,
): MarketObservation => ({
  id: `obs-${(n += 1)}`,
  observedAt: d(on),
  askingPrice: rupiah(price),
  mileage: null,
  listingAgeDays,
})

describe('percentile()', () => {
  it('returns null for an empty series', () => {
    expect(percentile([], 0.5)).toBeNull()
  })

  it('returns the only value for a single observation', () => {
    expect(percentile([21_000_000n], 0.5)).toBe(21_000_000n)
    expect(percentile([21_000_000n], 0.25)).toBe(21_000_000n)
  })

  it('finds the median of an odd-length series', () => {
    expect(percentile([10n, 20n, 30n], 0.5)).toBe(20n)
  })

  it('interpolates the median of an even-length series', () => {
    expect(percentile([10_000_000n, 20_000_000n], 0.5)).toBe(15_000_000n)
  })

  it('computes quartiles', () => {
    const series = [10n, 20n, 30n, 40n, 50n]
    expect(percentile(series, 0.25)).toBe(20n)
    expect(percentile(series, 0.75)).toBe(40n)
  })

  it('stays exact on realistic rupiah values', () => {
    const series = [21_000_000n, 22_000_000n, 23_000_000n, 26_000_000n]
    expect(percentile(series, 0.5)).toBe(22_500_000n)
  })
})

describe('snapshotsFromObservations()', () => {
  it('produces nothing from no observations', () => {
    expect(snapshotsFromObservations([])).toEqual([])
  })

  it('groups observations into months, oldest first', () => {
    const snapshots = snapshotsFromObservations([
      obs(26_000_000, '2026-08-12'),
      obs(24_000_000, '2026-07-04'),
      obs(25_000_000, '2026-08-20'),
    ])
    expect(snapshots).toHaveLength(2)
    expect(snapshots[0]?.periodStart).toEqual(d('2026-07-01'))
    expect(snapshots[1]?.periodStart).toEqual(d('2026-08-01'))
    expect(snapshots[1]?.listingCount).toBe(2)
  })

  it('marks observations as real, not synthetic (§39)', () => {
    const [snapshot] = snapshotsFromObservations([obs(26_000_000, '2026-08-12')])
    expect(snapshot?.provenance.source).toBe('MANUAL')
    expect(snapshot?.provenance.confidence).not.toBe('NONE')
  })

  it('raises confidence as the sample grows', () => {
    const few = snapshotsFromObservations(
      Array.from({ length: 3 }, (_, i) => obs(26_000_000, `2026-08-0${i + 1}`)),
    )
    const many = snapshotsFromObservations(
      Array.from({ length: 14 }, (_, i) =>
        obs(26_000_000, `2026-08-${String(i + 1).padStart(2, '0')}`),
      ),
    )
    expect(few[0]?.provenance.confidence).toBe('LOW')
    expect(many[0]?.provenance.confidence).toBe('HIGH')
  })

  it('reports the sample size behind each snapshot', () => {
    const [snapshot] = snapshotsFromObservations([
      obs(26_000_000, '2026-08-12'),
      obs(25_000_000, '2026-08-14'),
    ])
    expect(snapshot?.provenance.sampleSize).toBe(2)
  })

  it('leaves days-to-sell null when no listing age was recorded', () => {
    const [snapshot] = snapshotsFromObservations([obs(26_000_000, '2026-08-12')])
    expect(snapshot?.avgDaysToSell).toBeNull()
  })

  it('averages listing age when it is recorded', () => {
    const [snapshot] = snapshotsFromObservations([
      obs(26_000_000, '2026-08-12', 10),
      obs(25_000_000, '2026-08-14', 20),
    ])
    expect(snapshot?.avgDaysToSell).toBe(15)
  })

  it('skips a month with no observations rather than interpolating it', () => {
    // A gap in the record must be reported as a gap (§39).
    const snapshots = snapshotsFromObservations([
      obs(24_000_000, '2026-06-04'),
      obs(26_000_000, '2026-08-12'),
    ])
    expect(snapshots.map((s) => s.periodStart.toISOString().slice(0, 7))).toEqual([
      '2026-06',
      '2026-08',
    ])
  })
})
