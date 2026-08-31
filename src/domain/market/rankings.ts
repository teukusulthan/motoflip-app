/**
 * Market rankings — §24.
 *
 * Six views over the tracked models. Each is a pure function of scored market
 * data, and each states what it actually sorts by, so a list is never a black
 * box ordering.
 *
 * §29 applies here too: "Trending" is a demand list and is labelled as such.
 * It is deliberately NOT the default view, because the highest-growth model is
 * not the same question as the most profitable one to buy.
 */
import type { BasisPoints } from '../money'
import {
  type MarketScore,
  demandGrowthBps,
  hasSustainedGrowth,
  scoreMarket,
} from './scoring'
import type { MarketView } from './types'

export interface RankedModel {
  view: MarketView
  score: MarketScore
  growthBps: BasisPoints | null
  sustained: boolean
}

export function rankModels(views: readonly MarketView[]): RankedModel[] {
  return views.map((view) => ({
    view,
    score: scoreMarket(view),
    growthBps: demandGrowthBps(view),
    sustained: hasSustainedGrowth(view),
  }))
}

export type RankingKey =
  | 'trending'
  | 'profitable'
  | 'fastest'
  | 'rising'
  | 'undervalued'
  | 'declining'

export interface RankingDefinition {
  key: RankingKey
  label: string
  /** What this list actually sorts by — shown in the UI, not just a comment. */
  description: string
}

export const RANKINGS: readonly RankingDefinition[] = [
  {
    key: 'profitable',
    label: 'Paling Menguntungkan',
    description: 'Selisih beli-jual terbesar relatif terhadap harga beli.',
  },
  {
    key: 'fastest',
    label: 'Paling Cepat Laku',
    description: 'Rata-rata hari terjual paling singkat.',
  },
  {
    key: 'trending',
    label: 'Sedang Naik',
    description: 'Pertumbuhan permintaan bulan terakhir terbesar.',
  },
  {
    key: 'rising',
    label: 'Permintaan Menguat',
    description: 'Permintaan naik konsisten minimal tiga bulan berturut-turut.',
  },
  {
    key: 'undervalued',
    label: 'Undervalued',
    description: 'Permintaan tinggi relatif terhadap harga pasar saat ini.',
  },
  {
    key: 'declining',
    label: 'Menurun',
    description: 'Permintaan turun — pertimbangkan menghindari atau melepas cepat.',
  },
]

const componentScore = (
  ranked: RankedModel,
  key: 'profitPotential' | 'liquidity' | 'demand',
): number | null =>
  ranked.score.components.find((c) => c.key === key)?.score ?? null

const byDesc = (value: (r: RankedModel) => number | null) =>
  (a: RankedModel, b: RankedModel) =>
    (value(b) ?? Number.NEGATIVE_INFINITY) - (value(a) ?? Number.NEGATIVE_INFINITY)

/**
 * Percentile rank of a value within a series, 0–100.
 * Used by "undervalued", which is inherently a relative question.
 */
function percentileRank(values: number[], value: number): number {
  if (values.length <= 1) return 50
  const below = values.filter((v) => v < value).length
  return Math.round((below / (values.length - 1)) * 100)
}

export function applyRanking(
  key: RankingKey,
  ranked: readonly RankedModel[],
): RankedModel[] {
  const items = [...ranked]

  switch (key) {
    case 'profitable':
      return items
        .filter((r) => componentScore(r, 'profitPotential') !== null)
        .sort(byDesc((r) => componentScore(r, 'profitPotential')))

    case 'fastest':
      return items
        .filter((r) => r.score.avgDaysToSell !== null)
        .sort(
          (a, b) =>
            (a.score.avgDaysToSell ?? Number.POSITIVE_INFINITY) -
            (b.score.avgDaysToSell ?? Number.POSITIVE_INFINITY),
        )

    case 'trending':
      return items
        .filter((r) => r.growthBps !== null && r.growthBps > 0)
        .sort(byDesc((r) => r.growthBps))

    case 'rising':
      // Sustained growth only — a single spike does not qualify.
      return items
        .filter((r) => r.sustained)
        .sort(byDesc((r) => r.growthBps))

    case 'undervalued': {
      const withData = items.filter(
        (r) => r.score.medianPrice !== null && componentScore(r, 'demand') !== null,
      )
      const demands = withData.map((r) => componentScore(r, 'demand') as number)
      const prices = withData.map((r) => Number(r.score.medianPrice))

      return withData
        .map((r) => ({
          ranked: r,
          gap:
            percentileRank(demands, componentScore(r, 'demand') as number) -
            percentileRank(prices, Number(r.score.medianPrice)),
        }))
        // Demand well above what the price implies.
        .filter((entry) => entry.gap > 0)
        .sort((a, b) => b.gap - a.gap)
        .map((entry) => entry.ranked)
    }

    case 'declining':
      return items
        .filter((r) => r.growthBps !== null && r.growthBps < 0)
        .sort((a, b) => (a.growthBps ?? 0) - (b.growthBps ?? 0))
  }
}
