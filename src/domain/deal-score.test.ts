import { describe, expect, it } from 'vitest'
import { motorcycle, purchase, sale } from './__fixtures__/builders'
import {
  provenance as marketProvenance,
  view as marketView,
} from './market/__fixtures__'
import {
  DEAL_SCORE_CONFIG,
  type DealInput,
  interpolate,
  personalHistory,
  projectDeal,
  scoreDeal,
} from './deal-score'
import { rupiah } from './money'

const deal = (overrides: Partial<DealInput> = {}): DealInput => ({
  brand: 'Yamaha',
  model: 'NMAX',
  year: 2022,
  sellerPrice: rupiah(22_000_000),
  expectedPurchase: rupiah(21_500_000),
  estimatedRepair: rupiah(1_500_000),
  expectedSale: rupiah(27_000_000),
  ...overrides,
})

describe('projectDeal() — the §21 example', () => {
  const p = projectDeal(deal())

  it('sums the projected cost', () => {
    expect(p.projectedCost).toBe(23_000_000n)
  })

  it('projects the profit', () => {
    expect(p.projectedProfit).toBe(4_000_000n)
  })

  it('projects ROI to 17.39%', () => {
    expect(p.projectedRoi).toBe(1739)
  })

  it('reports the negotiation saving off the asking price', () => {
    expect(p.negotiationSaving).toBe(500_000n)
  })

  it('reports repair as a share of total cost', () => {
    expect(p.repairShareBps).toBe(652)
  })
})

describe('interpolate()', () => {
  it('clamps below the first anchor and above the last', () => {
    const anchors = [
      [0, 0],
      [100, 100],
    ] as const
    expect(interpolate(anchors, -50)).toBe(0)
    expect(interpolate(anchors, 500)).toBe(100)
  })

  it('interpolates linearly between anchors', () => {
    const anchors = [
      [0, 0],
      [100, 50],
    ] as const
    expect(interpolate(anchors, 50)).toBe(25)
  })
})

describe('scoreDeal() honesty rules (§29, §30, §39)', () => {
  it('never claims HIGH confidence while market data is unavailable', () => {
    const result = scoreDeal(deal(), [], [])
    expect(result.confidence).not.toBe('HIGH')
  })

  it('names the missing market signal rather than fabricating it', () => {
    const result = scoreDeal(deal(), [], [])
    expect(result.missingSignals.join(' ')).toMatch(/pasar/i)
  })

  it('does not score the history component with no history', () => {
    const result = scoreDeal(deal(), [], [])
    const history = result.components.find((c) => c.key === 'history')
    expect(history?.score).toBeNull()
  })

  it('renormalises weights so an unscored component is not treated as zero', () => {
    const withoutHistory = scoreDeal(deal(), [], [])
    // A strong deal must still score well when history is simply unknown.
    expect(withoutHistory.score).toBeGreaterThan(DEAL_SCORE_CONFIG.bands.consider)
  })

  it('refuses to recommend a deal that loses money, whatever else scores well', () => {
    const result = scoreDeal(
      deal({ expectedSale: rupiah(21_000_000) }),
      [],
      [],
    )
    expect(result.projection.projectedProfit).toBeLessThan(0n)
    expect(result.band).toBe('AVOID')
  })

  it('penalises a deal whose margin rests on heavy repairs', () => {
    const light = scoreDeal(deal({ estimatedRepair: rupiah(500_000) }), [], [])
    const heavy = scoreDeal(
      deal({
        estimatedRepair: rupiah(8_000_000),
        expectedPurchase: rupiah(15_000_000),
      }),
      [],
      [],
    )
    const lightRisk = light.components.find((c) => c.key === 'repairRisk')?.score
    const heavyRisk = heavy.components.find((c) => c.key === 'repairRisk')?.score
    expect(heavyRisk).toBeLessThan(lightRisk as number)
  })
})

describe('scoreDeal() with personal history (§28)', () => {
  const bikes = [
    motorcycle({ id: 'h1', status: 'SOLD', brand: 'Yamaha', model: 'NMAX', year: 2022 }),
    motorcycle({ id: 'h2', status: 'SOLD', brand: 'Yamaha', model: 'NMAX', year: 2022 }),
    motorcycle({ id: 'h3', status: 'SOLD', brand: 'Yamaha', model: 'NMAX', year: 2022 }),
  ]
  const entries = [
    purchase(20_000_000, '2026-06-01', 'h1'),
    sale(23_400_000, '2026-06-18', 'h1'),
    purchase(20_000_000, '2026-07-01', 'h2'),
    sale(23_400_000, '2026-07-18', 'h2'),
    purchase(20_000_000, '2026-07-20', 'h3'),
    sale(23_400_000, '2026-08-06', 'h3'),
  ]

  it('finds same-model, same-year history (§25)', () => {
    const history = personalHistory(
      { brand: 'Yamaha', model: 'NMAX', year: 2022 },
      bikes,
      entries,
    )
    expect(history.matchingYearCount).toBe(3)
    expect(history.averageRoi).toBe(1700)
    expect(history.averageDaysToSell).toBe(17)
  })

  it('raises confidence once enough comparable flips exist', () => {
    expect(scoreDeal(deal(), bikes, entries).confidence).toBe('MEDIUM')
    expect(scoreDeal(deal(), [], []).confidence).toBe('LOW')
  })

  it('scores the history component once history exists', () => {
    const result = scoreDeal(deal(), bikes, entries)
    const history = result.components.find((c) => c.key === 'history')
    expect(history?.score).not.toBeNull()
  })

  it('rates a deal beating your own average above one lagging it', () => {
    const strong = scoreDeal(deal({ expectedSale: rupiah(28_000_000) }), bikes, entries)
    const weak = scoreDeal(deal({ expectedSale: rupiah(24_500_000) }), bikes, entries)
    expect(strong.score).toBeGreaterThan(weak.score)
  })

  it('reports no match for a model never flipped before', () => {
    const history = personalHistory(
      { brand: 'Honda', model: 'Vario', year: 2023 },
      bikes,
      entries,
    )
    expect(history.matchingYearCount).toBe(0)
    expect(history.averageRoi).toBeNull()
    expect(history.label).toBeNull()
  })
})

describe('scoreDeal() with market context — §30', () => {
  const bikes = [
    motorcycle({ id: 'h1', status: 'SOLD', brand: 'Yamaha', model: 'NMAX', year: 2022 }),
    motorcycle({ id: 'h2', status: 'SOLD', brand: 'Yamaha', model: 'NMAX', year: 2022 }),
    motorcycle({ id: 'h3', status: 'SOLD', brand: 'Yamaha', model: 'NMAX', year: 2022 }),
  ]
  const entries = [
    purchase(20_000_000, '2026-06-01', 'h1'),
    sale(23_400_000, '2026-06-18', 'h1'),
    purchase(20_000_000, '2026-07-01', 'h2'),
    sale(23_400_000, '2026-07-18', 'h2'),
    purchase(20_000_000, '2026-07-20', 'h3'),
    sale(23_400_000, '2026-08-06', 'h3'),
  ]

  it('reports no market context when the model is not tracked', () => {
    const result = scoreDeal(deal(), bikes, entries)
    expect(result.market).toBeNull()
    expect(result.missingSignals.join(' ')).toMatch(/belum dipantau/i)
    expect(
      result.components.find((c) => c.key === 'marketAlignment')?.score,
    ).toBeNull()
  })

  it('shows synthetic market data but refuses to score with it (§39)', () => {
    const demo = marketView({
      provenance: marketProvenance({ source: 'DEMO', confidence: 'NONE' }),
    })
    const result = scoreDeal(deal(), bikes, entries, demo)

    expect(result.market).not.toBeNull()
    expect(result.market?.counted).toBe(false)
    expect(
      result.components.find((c) => c.key === 'marketAlignment')?.score,
    ).toBeNull()
    expect(result.missingSignals.join(' ')).toMatch(/ilustrasi/i)
  })

  it('produces an identical score with and without synthetic market data', () => {
    // The strongest guarantee: an illustration cannot move the number.
    const withoutMarket = scoreDeal(deal(), bikes, entries)
    const withDemo = scoreDeal(
      deal(),
      bikes,
      entries,
      marketView({
        provenance: marketProvenance({ source: 'DEMO', confidence: 'NONE' }),
      }),
    )
    expect(withDemo.score).toBe(withoutMarket.score)
  })

  it('scores market alignment once the data is real', () => {
    const real = marketView({
      provenance: marketProvenance({ source: 'MANUAL', confidence: 'MEDIUM' }),
    })
    const result = scoreDeal(deal(), bikes, entries, real)
    expect(result.market?.counted).toBe(true)
    expect(
      result.components.find((c) => c.key === 'marketAlignment')?.score,
    ).not.toBeNull()
  })

  it('rates buying below the market better than buying above it', () => {
    const real = marketView({
      provenance: marketProvenance({ source: 'MANUAL', confidence: 'MEDIUM' }),
    })
    // Fixture market: P25 23,000,000 / median 26,000,000.
    const cheap = scoreDeal(
      deal({ expectedPurchase: rupiah(21_000_000) }),
      bikes,
      entries,
      real,
    )
    const dear = scoreDeal(
      deal({ expectedPurchase: rupiah(25_000_000) }),
      bikes,
      entries,
      real,
    )
    const cheapScore = cheap.components.find((c) => c.key === 'marketAlignment')?.score
    const dearScore = dear.components.find((c) => c.key === 'marketAlignment')?.score
    expect(cheapScore).toBeGreaterThan(dearScore as number)
  })

  it('penalises an expected sale far above the market median', () => {
    const real = marketView({
      provenance: marketProvenance({ source: 'MANUAL', confidence: 'MEDIUM' }),
    })
    const realistic = scoreDeal(
      deal({ expectedSale: rupiah(25_800_000) }),
      bikes,
      entries,
      real,
    )
    const wishful = scoreDeal(
      deal({ expectedSale: rupiah(33_000_000) }),
      bikes,
      entries,
      real,
    )
    const realisticScore = realistic.components.find(
      (c) => c.key === 'marketAlignment',
    )?.score
    const wishfulScore = wishful.components.find(
      (c) => c.key === 'marketAlignment',
    )?.score
    expect(realisticScore).toBeGreaterThan(wishfulScore as number)
  })

  it('reaches HIGH confidence only with both real market data and real history', () => {
    const real = marketView({
      provenance: marketProvenance({ source: 'MANUAL', confidence: 'MEDIUM' }),
    })
    expect(scoreDeal(deal(), bikes, entries, real).confidence).toBe('HIGH')
    // Market data but no personal history.
    expect(scoreDeal(deal(), [], [], real).confidence).toBe('MEDIUM')
    // Personal history but no market data.
    expect(scoreDeal(deal(), bikes, entries).confidence).toBe('MEDIUM')
    // Neither.
    expect(scoreDeal(deal(), [], []).confidence).toBe('LOW')
  })
})
