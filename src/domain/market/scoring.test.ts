import { describe, expect, it } from 'vitest'
import { rupiah } from '../money'
import {
  MARKET_SCORE_CONFIG,
  demandGrowthBps,
  hasSustainedGrowth,
  marketBand,
  scoreMarket,
} from './scoring'
import { provenance, risingHistory, snapshot, view } from './__fixtures__'

describe('demandGrowthBps()', () => {
  it('computes month-over-month growth', () => {
    // 81 → 89 is +9.88%
    const v = view({ history: risingHistory() })
    expect(demandGrowthBps(v)).toBe(988)
  })

  it('is null with a single snapshot — one reading is not a trend', () => {
    expect(demandGrowthBps(view())).toBeNull()
  })

  it('is null with no snapshots', () => {
    expect(demandGrowthBps(view({ history: [] }))).toBeNull()
  })

  it('is negative for falling demand', () => {
    const v = view({
      history: [
        snapshot({ periodStart: '2026-07-01', demandIndex: 80 }),
        snapshot({ periodStart: '2026-08-01', demandIndex: 60 }),
      ],
    })
    expect(demandGrowthBps(v)).toBe(-2500)
  })
})

describe('hasSustainedGrowth()', () => {
  it('is true for a consistently rising series', () => {
    expect(hasSustainedGrowth(view({ history: risingHistory() }))).toBe(true)
  })

  it('rejects a single spike after a flat run', () => {
    // A lucky month must not qualify a model as "rising demand" (§24).
    const v = view({
      history: [
        snapshot({ periodStart: '2026-05-01', demandIndex: 60 }),
        snapshot({ periodStart: '2026-06-01', demandIndex: 60 }),
        snapshot({ periodStart: '2026-07-01', demandIndex: 60 }),
        snapshot({ periodStart: '2026-08-01', demandIndex: 95 }),
      ],
    })
    expect(hasSustainedGrowth(v)).toBe(false)
  })

  it('is false without enough history to judge', () => {
    expect(hasSustainedGrowth(view())).toBe(false)
  })
})

describe('scoreMarket()', () => {
  it('produces a score from a complete snapshot', () => {
    const result = scoreMarket(view({ history: risingHistory() }))
    expect(result.score).not.toBeNull()
    expect(result.score).toBeGreaterThan(0)
    expect(result.score).toBeLessThanOrEqual(100)
    expect(result.missingSignals).toEqual([])
  })

  it('exposes every component with its weight and rationale', () => {
    const result = scoreMarket(view())
    expect(result.components.map((c) => c.key)).toEqual([
      'demand',
      'priceStability',
      'liquidity',
      'competition',
      'profitPotential',
    ])
    for (const component of result.components) {
      expect(component.rationale.length).toBeGreaterThan(0)
      expect(component.weight).toBeGreaterThan(0)
    }
  })

  it('names each missing signal instead of scoring it zero (§39)', () => {
    const bare = view({
      history: [
        snapshot({
          periodStart: '2026-08-01',
          demandIndex: null,
          avgDaysToSell: null,
          listingCount: null,
        }),
      ],
    })
    const result = scoreMarket(bare)
    expect(result.missingSignals).toContain('Indeks permintaan')
    expect(result.missingSignals).toContain('Kecepatan jual')
    expect(result.missingSignals).toContain('Jumlah listing')
    expect(result.components.find((c) => c.key === 'demand')?.score).toBeNull()
  })

  it('returns a null score when nothing at all is known', () => {
    const result = scoreMarket(view({ history: [] }))
    expect(result.score).toBeNull()
    expect(result.confidence).toBe('NONE')
  })

  it('carries NONE confidence through from synthetic data (§39)', () => {
    const demo = view({
      provenance: provenance({ source: 'DEMO', confidence: 'NONE' }),
    })
    expect(scoreMarket(demo).confidence).toBe('NONE')
  })

  it('downgrades confidence when most components could not be scored', () => {
    const sparse = view({
      provenance: provenance({ confidence: 'HIGH' }),
      history: [
        snapshot({
          periodStart: '2026-08-01',
          demandIndex: null,
          avgDaysToSell: null,
          medianPrice: null,
          p25Price: null,
          p75Price: null,
        }),
      ],
    })
    expect(scoreMarket(sparse).confidence).toBe('LOW')
  })
})

describe('§29 — rising demand alone is not a good flip', () => {
  const strongDemand = { demandIndex: 95, listingCount: 8 }

  it('scores a high-demand model with no margin below one with margin', () => {
    const noMargin = scoreMarket(
      view({
        history: [
          snapshot({
            periodStart: '2026-08-01',
            ...strongDemand,
            p25Price: rupiah(25_800_000),
            medianPrice: rupiah(26_000_000),
            p75Price: rupiah(26_200_000),
          }),
        ],
      }),
    )
    const withMargin = scoreMarket(
      view({
        history: [
          snapshot({
            periodStart: '2026-08-01',
            ...strongDemand,
            p25Price: rupiah(21_000_000),
            medianPrice: rupiah(26_000_000),
            p75Price: rupiah(28_000_000),
          }),
        ],
      }),
    )
    expect(withMargin.score).toBeGreaterThan(noMargin.score as number)
  })

  it('penalises heavy competition even when demand is high', () => {
    const crowded = scoreMarket(
      view({
        history: [
          snapshot({ periodStart: '2026-08-01', demandIndex: 95, listingCount: 140 }),
        ],
      }),
    )
    const quiet = scoreMarket(
      view({
        history: [
          snapshot({ periodStart: '2026-08-01', demandIndex: 95, listingCount: 6 }),
        ],
      }),
    )
    expect(quiet.score).toBeGreaterThan(crowded.score as number)
  })

  it('weights demand below liquidity and profit potential combined', () => {
    const { weights } = MARKET_SCORE_CONFIG
    expect(weights.demand).toBeLessThan(weights.liquidity + weights.profitPotential)
  })

  it('penalises slow-selling stock even when demand is high', () => {
    const slow = scoreMarket(
      view({
        history: [
          snapshot({ periodStart: '2026-08-01', demandIndex: 95, avgDaysToSell: 70 }),
        ],
      }),
    )
    const fast = scoreMarket(
      view({
        history: [
          snapshot({ periodStart: '2026-08-01', demandIndex: 95, avgDaysToSell: 9 }),
        ],
      }),
    )
    expect(fast.score).toBeGreaterThan(slow.score as number)
  })
})

describe('marketBand()', () => {
  it('maps scores onto bands', () => {
    expect(marketBand(90)).toBe('STRONG')
    expect(marketBand(65)).toBe('MODERATE')
    expect(marketBand(50)).toBe('WEAK')
    expect(marketBand(20)).toBe('POOR')
  })

  it('is null for an unscored model', () => {
    expect(marketBand(null)).toBeNull()
  })
})
