import { describe, expect, it } from 'vitest'
import { motorcycle, purchase, sale, cost } from '../__fixtures__/builders'
import {
  OPPORTUNITY_BAND_LABELS,
  personalPerformance,
  scoreOpportunity,
  scorePersonal,
} from './opportunity'
import { provenance, risingHistory, view } from './__fixtures__'

/** Three completed NMAX 2022 flips at a healthy ROI. */
function nmaxHistory(count = 3) {
  const bikes = []
  const entries = []
  for (let i = 0; i < count; i += 1) {
    const id = `nmax-${i}`
    bikes.push(
      motorcycle({ id, status: 'SOLD', brand: 'Yamaha', model: 'NMAX', year: 2022 }),
    )
    entries.push(
      purchase(20_000_000, '2026-06-01', id),
      cost(500_000, 'REPAIR', '2026-06-03', id),
      sale(24_000_000, '2026-06-18', id),
    )
  }
  return { bikes, entries }
}

describe('personalPerformance()', () => {
  it('summarises completed flips of the exact model and year', () => {
    const { bikes, entries } = nmaxHistory(3)
    const p = personalPerformance(
      { brand: 'Yamaha', model: 'NMAX', year: 2022 },
      bikes,
      entries,
    )
    expect(p.flips).toBe(3)
    // (24,000,000 − 20,500,000) × 3 = 10,500,000 over 61,500,000
    expect(p.totalProfit).toBe(10_500_000n)
    expect(p.roi).toBe(1707)
    expect(p.averageDaysToSell).toBe(17)
  })

  it('does not count a different year as the same model (§25)', () => {
    const { bikes, entries } = nmaxHistory(2)
    const p = personalPerformance(
      { brand: 'Yamaha', model: 'NMAX', year: 2023 },
      bikes,
      entries,
    )
    expect(p.flips).toBe(0)
    expect(p.roi).toBeNull()
  })

  it('ignores bikes still in inventory', () => {
    const p = personalPerformance(
      { brand: 'Yamaha', model: 'NMAX', year: 2022 },
      [motorcycle({ id: 'a', status: 'OWNED', model: 'NMAX', year: 2022 })],
      [purchase(20_000_000, '2026-06-01', 'a')],
    )
    expect(p.flips).toBe(0)
  })

  it('matches case-insensitively', () => {
    const { bikes, entries } = nmaxHistory(1)
    const p = personalPerformance(
      { brand: 'yamaha', model: 'nmax', year: 2022 },
      bikes,
      entries,
    )
    expect(p.flips).toBe(1)
  })
})

describe('scorePersonal()', () => {
  it('is unscored with no history, rather than zero', () => {
    const result = scorePersonal({
      flips: 0,
      roi: null,
      averageDaysToSell: null,
      totalProfit: 0n as never,
      bestProfit: null,
      worstProfit: null,
    })
    expect(result.score).toBeNull()
    expect(result.confidence).toBe('NONE')
  })

  it('raises confidence with more completed flips', () => {
    const { bikes, entries } = nmaxHistory(4)
    const many = scorePersonal(
      personalPerformance({ brand: 'Yamaha', model: 'NMAX', year: 2022 }, bikes, entries),
    )
    const one = nmaxHistory(1)
    const few = scorePersonal(
      personalPerformance(
        { brand: 'Yamaha', model: 'NMAX', year: 2022 },
        one.bikes,
        one.entries,
      ),
    )
    expect(many.confidence).toBe('HIGH')
    expect(few.confidence).toBe('LOW')
  })
})

describe('scoreOpportunity() — §28', () => {
  const { bikes, entries } = nmaxHistory(3)

  it('keeps market, personal and combined as separate figures', () => {
    const result = scoreOpportunity(view({ history: risingHistory() }), bikes, entries)
    expect(result.market.score).not.toBeNull()
    expect(result.personal.score).not.toBeNull()
    expect(result.combined).not.toBeNull()
  })

  it('ignores synthetic market data entirely when combining (§39)', () => {
    // A DEMO source carries zero weight, so the combined score is purely the
    // user's own track record — and says so.
    const demo = view({
      history: risingHistory(),
      provenance: provenance({ source: 'DEMO', confidence: 'NONE' }),
    })
    const result = scoreOpportunity(demo, bikes, entries)

    expect(result.marketShare).toBe(0)
    expect(result.personalShare).toBe(100)
    expect(result.combined).toBe(result.personal.score)
    expect(result.basis).toMatch(/rekam jejak Anda/i)
  })

  it('falls back to market data alone when there is no personal history', () => {
    const result = scoreOpportunity(view({ history: risingHistory() }), [], [])
    expect(result.personal.score).toBeNull()
    expect(result.personalShare).toBe(0)
    expect(result.combined).toBe(result.market.score)
    expect(result.basis).toMatch(/data pasar/i)
  })

  it('cannot be scored when neither side has evidence', () => {
    const demo = view({
      history: [],
      provenance: provenance({ source: 'DEMO', confidence: 'NONE' }),
    })
    const result = scoreOpportunity(demo, [], [])
    expect(result.combined).toBeNull()
    expect(result.band).toBeNull()
    expect(result.confidence).toBe('NONE')
    expect(result.basis).toMatch(/tidak dapat dihitung/i)
  })

  it('blends both sides when each has real evidence', () => {
    const real = view({
      history: risingHistory(),
      provenance: provenance({ source: 'MANUAL', confidence: 'MEDIUM' }),
    })
    const result = scoreOpportunity(real, bikes, entries)
    expect(result.marketShare).toBeGreaterThan(0)
    expect(result.personalShare).toBeGreaterThan(0)
    expect(result.marketShare + result.personalShare).toBe(100)
  })

  it('leans on the user when their history is deeper than the market data', () => {
    const { bikes: many, entries: manyEntries } = nmaxHistory(8)
    const weakMarket = view({
      history: risingHistory(),
      provenance: provenance({ source: 'MANUAL', confidence: 'LOW' }),
    })
    const result = scoreOpportunity(weakMarket, many, manyEntries)
    expect(result.personalShare).toBeGreaterThan(result.marketShare)
  })

  it('labels every band', () => {
    expect(Object.keys(OPPORTUNITY_BAND_LABELS)).toHaveLength(4)
  })
})
