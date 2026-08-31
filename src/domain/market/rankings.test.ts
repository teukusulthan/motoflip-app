import { describe, expect, it } from 'vitest'
import { rupiah } from '../money'
import { RANKINGS, applyRanking, rankModels } from './rankings'
import { ref, snapshot, view } from './__fixtures__'

const model = (
  id: string,
  latest: Parameters<typeof snapshot>[0],
  previous?: Parameters<typeof snapshot>[0],
) =>
  view({
    ref: ref({ id, model: id }),
    history: previous
      ? [snapshot(previous), snapshot(latest)]
      : [snapshot(latest)],
  })

describe('RANKINGS', () => {
  it('states what each list sorts by', () => {
    expect(RANKINGS).toHaveLength(6)
    for (const ranking of RANKINGS) {
      expect(ranking.description.length).toBeGreaterThan(10)
    }
  })

  it('does not lead with the demand list (§29)', () => {
    // "Trending" is a demand question, not a profit question, so it must not be
    // the first thing the user sees.
    expect(RANKINGS[0]?.key).not.toBe('trending')
    expect(RANKINGS[0]?.key).toBe('profitable')
  })
})

describe('applyRanking()', () => {
  const wideMargin = model('wide', {
    periodStart: '2026-08-01',
    p25Price: rupiah(20_000_000),
    medianPrice: rupiah(26_000_000),
    avgDaysToSell: 30,
  })
  const thinMargin = model('thin', {
    periodStart: '2026-08-01',
    p25Price: rupiah(25_500_000),
    medianPrice: rupiah(26_000_000),
    avgDaysToSell: 9,
  })
  const ranked = rankModels([thinMargin, wideMargin])

  it('sorts "profitable" by margin, not by speed', () => {
    const result = applyRanking('profitable', ranked)
    expect(result[0]?.view.ref.id).toBe('wide')
  })

  it('sorts "fastest" by days to sell', () => {
    const result = applyRanking('fastest', ranked)
    expect(result[0]?.view.ref.id).toBe('thin')
  })

  it('includes only genuinely growing models in "trending"', () => {
    const rising = model(
      'rising',
      { periodStart: '2026-08-01', demandIndex: 90 },
      { periodStart: '2026-07-01', demandIndex: 60 },
    )
    const falling = model(
      'falling',
      { periodStart: '2026-08-01', demandIndex: 40 },
      { periodStart: '2026-07-01', demandIndex: 70 },
    )
    const result = applyRanking('trending', rankModels([rising, falling]))
    expect(result).toHaveLength(1)
    expect(result[0]?.growthBps).toBeGreaterThan(0)
  })

  it('lists only falling models in "declining", steepest first', () => {
    const mild = model(
      'mild',
      { periodStart: '2026-08-01', demandIndex: 65 },
      { periodStart: '2026-07-01', demandIndex: 70 },
    )
    const steep = model(
      'steep',
      { periodStart: '2026-08-01', demandIndex: 35 },
      { periodStart: '2026-07-01', demandIndex: 70 },
    )
    const result = applyRanking('declining', rankModels([mild, steep]))
    expect(result).toHaveLength(2)
    expect(result[0]?.view.ref.id).toBe(steep.ref.id)
  })

  it('excludes models with no trend data from trend-based lists', () => {
    const noHistory = view({ ref: ref({ id: 'x' }), history: [] })
    expect(applyRanking('trending', rankModels([noHistory]))).toHaveLength(0)
    expect(applyRanking('rising', rankModels([noHistory]))).toHaveLength(0)
    expect(applyRanking('declining', rankModels([noHistory]))).toHaveLength(0)
  })

  it('requires sustained growth for "rising", not a single jump', () => {
    const spike = view({
      ref: ref({ id: 'spike' }),
      history: [
        snapshot({ periodStart: '2026-05-01', demandIndex: 60 }),
        snapshot({ periodStart: '2026-06-01', demandIndex: 60 }),
        snapshot({ periodStart: '2026-07-01', demandIndex: 60 }),
        snapshot({ periodStart: '2026-08-01', demandIndex: 95 }),
      ],
    })
    const steady = view({
      ref: ref({ id: 'steady' }),
      history: [
        snapshot({ periodStart: '2026-05-01', demandIndex: 55 }),
        snapshot({ periodStart: '2026-06-01', demandIndex: 62 }),
        snapshot({ periodStart: '2026-07-01', demandIndex: 70 }),
        snapshot({ periodStart: '2026-08-01', demandIndex: 79 }),
      ],
    })
    const result = applyRanking('rising', rankModels([spike, steady]))
    expect(result.map((r) => r.view.ref.id)).toEqual(['steady'])
  })

  it('finds models whose demand outruns their price in "undervalued"', () => {
    const cheapHot = model('cheapHot', {
      periodStart: '2026-08-01',
      demandIndex: 95,
      medianPrice: rupiah(12_000_000),
    })
    const pricyCold = model('pricyCold', {
      periodStart: '2026-08-01',
      demandIndex: 35,
      medianPrice: rupiah(30_000_000),
    })
    const result = applyRanking('undervalued', rankModels([pricyCold, cheapHot]))
    expect(result[0]?.view.ref.id).toBe('cheapHot')
  })
})
