import { describe, expect, it } from 'vitest'
import { cost, d, entry, motorcycle, purchase, sale } from './__fixtures__/builders'
import {
  agingBucket,
  agingDistribution,
  averageDaysToSell,
  inventoryAging,
  overallRoi,
  performanceByModel,
  performanceBySource,
  vendorSpend,
} from './inventory'

describe('agingBucket() (§18)', () => {
  it('places days into the specified buckets', () => {
    expect(agingBucket(0)).toBe('0-15')
    expect(agingBucket(15)).toBe('0-15')
    expect(agingBucket(16)).toBe('16-30')
    expect(agingBucket(30)).toBe('16-30')
    expect(agingBucket(31)).toBe('31-60')
    expect(agingBucket(60)).toBe('31-60')
    expect(agingBucket(61)).toBe('60+')
    expect(agingBucket(400)).toBe('60+')
  })
})

describe('inventoryAging()', () => {
  const bikes = [
    motorcycle({ id: 'bike-1', status: 'OWNED' }),
    motorcycle({ id: 'bike-2', status: 'LISTED' }),
    motorcycle({ id: 'bike-3', status: 'SOLD' }),
  ]
  const entries = [
    purchase(20_000_000, '2026-08-20', 'bike-1'),
    purchase(18_000_000, '2026-06-01', 'bike-2'),
    purchase(15_000_000, '2026-05-01', 'bike-3'),
    sale(18_000_000, '2026-05-20', 'bike-3'),
  ]

  const rows = inventoryAging(bikes, entries, d('2026-08-31'))

  it('excludes sold bikes', () => {
    expect(rows.map((r) => r.motorcycle.id)).not.toContain('bike-3')
  })

  it('sorts oldest first', () => {
    expect(rows[0]?.motorcycle.id).toBe('bike-2')
  })

  it('reports days held and the capital locked in each bike', () => {
    const oldest = rows[0]
    expect(oldest?.days).toBe(91)
    expect(oldest?.bucket).toBe('60+')
    expect(oldest?.capital).toBe(18_000_000n)
  })

  it('summarises capital per bucket', () => {
    const distribution = agingDistribution(rows)
    expect(distribution['60+'].count).toBe(1)
    expect(distribution['60+'].capital).toBe(18_000_000n)
    expect(distribution['0-15'].count).toBe(1)
    expect(distribution['0-15'].capital).toBe(20_000_000n)
  })
})

describe('averageDaysToSell()', () => {
  it('is null with no completed flips, rather than zero', () => {
    expect(averageDaysToSell([motorcycle({ status: 'OWNED' })], [])).toBeNull()
  })

  it('averages the holding period of completed flips only', () => {
    const bikes = [
      motorcycle({ id: 'a', status: 'SOLD' }),
      motorcycle({ id: 'b', status: 'SOLD' }),
      motorcycle({ id: 'c', status: 'OWNED' }),
    ]
    const entries = [
      purchase(10_000_000, '2026-08-01', 'a'),
      sale(12_000_000, '2026-08-11', 'a'),
      purchase(10_000_000, '2026-08-01', 'b'),
      sale(12_000_000, '2026-08-21', 'b'),
      purchase(10_000_000, '2026-01-01', 'c'),
    ]
    expect(averageDaysToSell(bikes, entries)).toBe(15)
  })
})

describe('performance grouping (§17, §19)', () => {
  const bikes = [
    motorcycle({ id: 'a', status: 'SOLD', acquisitionSource: 'OLX', model: 'NMAX' }),
    motorcycle({ id: 'b', status: 'SOLD', acquisitionSource: 'DEALER', model: 'PCX' }),
    motorcycle({ id: 'c', status: 'OWNED', acquisitionSource: 'OLX', model: 'NMAX' }),
  ]
  const entries = [
    purchase(20_000_000, '2026-08-01', 'a'),
    sale(24_000_000, '2026-08-11', 'a'),
    purchase(20_000_000, '2026-08-01', 'b'),
    sale(21_000_000, '2026-08-11', 'b'),
    purchase(20_000_000, '2026-08-01', 'c'),
  ]

  it('ranks acquisition sources by ROI', () => {
    const groups = performanceBySource(bikes, entries)
    expect(groups[0]?.key).toBe('OLX')
    expect(groups[0]?.roi).toBe(2000)
    expect(groups[1]?.key).toBe('DEALER')
    expect(groups[1]?.roi).toBe(500)
  })

  it('excludes unsold bikes from performance groups', () => {
    const groups = performanceBySource(bikes, entries)
    expect(groups.find((g) => g.key === 'OLX')?.count).toBe(1)
  })

  it('groups by brand and model', () => {
    const groups = performanceByModel(bikes, entries)
    expect(groups.map((g) => g.key)).toContain('Yamaha NMAX')
    expect(groups.map((g) => g.key)).toContain('Yamaha PCX')
  })

  it('computes overall ROI across every completed flip', () => {
    // 5,000,000 profit over 40,000,000 cost.
    expect(overallRoi(bikes, entries)).toBe(1250)
  })
})

describe('vendorSpend() (§20)', () => {
  it('aggregates spend per vendor and ignores entries without one', () => {
    const entries = [
      entry({ amount: 450_000, vendorId: 'v1' }),
      entry({ amount: 150_000, vendorId: 'v1' }),
      entry({ amount: 900_000, vendorId: 'v2' }),
      entry({ amount: 100_000, vendorId: null }),
    ]
    const spend = vendorSpend(entries)
    expect(spend).toHaveLength(2)
    expect(spend[0]?.vendorId).toBe('v2')
    expect(spend[0]?.totalSpend).toBe(900_000n)

    const v1 = spend.find((s) => s.vendorId === 'v1')
    expect(v1?.transactions).toBe(2)
    expect(v1?.totalSpend).toBe(600_000n)
    expect(v1?.averageSpend).toBe(300_000n)
  })

  it('ignores voided entries', () => {
    const entries = [
      entry({ amount: 450_000, vendorId: 'v1' }),
      entry({ amount: 999_000, vendorId: 'v1', voidedAt: d('2026-08-09') }),
    ]
    expect(vendorSpend(entries)[0]?.totalSpend).toBe(450_000n)
  })
})

describe('cost() fixture sanity', () => {
  it('builds an expense in the requested group', () => {
    expect(cost(100_000, 'LOGISTICS').categoryGroup).toBe('LOGISTICS')
  })
})
