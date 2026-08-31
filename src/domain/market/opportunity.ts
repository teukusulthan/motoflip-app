/**
 * Opportunity Score — §28, §29.
 *
 * Three distinct scores, deliberately kept separate rather than collapsed into
 * one number:
 *
 *   Market   — what the outside world says about this model.
 *   Personal — what YOUR OWN completed flips of this model say.
 *   Combined — both, weighted by how much real evidence each side has.
 *
 * The weighting is the point. With no market data the combined score is your
 * own track record and says so; with no personal history it is the market and
 * says so. It never silently averages an illustration with a fact.
 */
import { type BasisPoints, type Rupiah, ratioToBps } from '../money'
import { interpolate } from '../interpolate'
import { holdingPeriodDays, netProfit, totalCost } from '../costing'
import { entriesFor } from '../ledger'
import type { DomainLedgerEntry, DomainMotorcycle } from '../types'
import { isClosed } from '../types'
import {
  CONFIDENCE_RANK,
  type MarketConfidence,
  type MarketModelRef,
  type MarketView,
} from './types'
import { type MarketScore, scoreMarket } from './scoring'

export const OPPORTUNITY_CONFIG = {
  /** Your realised ROI on this model, in bps → personal sub-score. */
  personalRoiAnchors: [
    [-1000, 0],
    [0, 15],
    [800, 45],
    [1400, 70],
    [2000, 88],
    [3000, 100],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Your average days-to-sell on this model → personal sub-score. */
  personalSpeedAnchors: [
    [7, 100],
    [14, 88],
    [21, 72],
    [30, 52],
    [45, 28],
    [75, 0],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Completed flips of this model → how much the personal side is trusted. */
  personalWeightAnchors: [
    [0, 0],
    [1, 30],
    [2, 45],
    [3, 60],
    [5, 75],
    [8, 85],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Market confidence rank → how much the market side is trusted. */
  marketWeightByConfidence: {
    NONE: 0,
    LOW: 30,
    MEDIUM: 55,
    HIGH: 75,
  } as Record<MarketConfidence, number>,
  bands: {
    strong: 78,
    good: 62,
    fair: 45,
  },
} as const

export interface PersonalPerformance {
  flips: number
  roi: BasisPoints | null
  averageDaysToSell: number | null
  totalProfit: Rupiah
  bestProfit: Rupiah | null
  worstProfit: Rupiah | null
}

/** The user's completed flips of exactly this model and year (§25). */
export function personalPerformance(
  ref: Pick<MarketModelRef, 'brand' | 'model' | 'year'>,
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): PersonalPerformance {
  const matching = motorcycles.filter(
    (m) =>
      isClosed(m.status) &&
      m.brand.toLowerCase() === ref.brand.toLowerCase() &&
      m.model.toLowerCase() === ref.model.toLowerCase() &&
      m.year === ref.year,
  )

  if (matching.length === 0) {
    return {
      flips: 0,
      roi: null,
      averageDaysToSell: null,
      totalProfit: 0n as Rupiah,
      bestProfit: null,
      worstProfit: null,
    }
  }

  const profits = matching.map((m) => netProfit(entriesFor(m.id, entries)))
  const costs = matching.map((m) => totalCost(entriesFor(m.id, entries)))
  const durations = matching
    .map((m) => holdingPeriodDays(entriesFor(m.id, entries)))
    .filter((d): d is number => d !== null)

  const totalProfit = profits.reduce((a, b) => a + b, 0n) as Rupiah
  const totalCostSum = costs.reduce((a, b) => a + b, 0n) as Rupiah

  const sorted = [...profits].sort((a, b) => (a > b ? 1 : a < b ? -1 : 0))

  return {
    flips: matching.length,
    roi: ratioToBps(totalProfit, totalCostSum),
    averageDaysToSell:
      durations.length === 0
        ? null
        : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
    totalProfit,
    bestProfit: sorted[sorted.length - 1] ?? null,
    worstProfit: sorted[0] ?? null,
  }
}

export interface PersonalScore {
  score: number | null
  confidence: MarketConfidence
  performance: PersonalPerformance
  rationale: string
}

export function scorePersonal(performance: PersonalPerformance): PersonalScore {
  if (performance.flips === 0 || performance.roi === null) {
    return {
      score: null,
      confidence: 'NONE',
      performance,
      rationale:
        'Anda belum pernah menyelesaikan flip untuk model dan tahun ini.',
    }
  }

  const config = OPPORTUNITY_CONFIG
  const roiScore = interpolate(config.personalRoiAnchors, performance.roi)
  const speedScore =
    performance.averageDaysToSell === null
      ? roiScore
      : interpolate(config.personalSpeedAnchors, performance.averageDaysToSell)

  // Return matters more than speed, but a slow flip ties up capital.
  const score = Math.round(roiScore * 0.65 + speedScore * 0.35)

  const confidence: MarketConfidence =
    performance.flips >= 4 ? 'HIGH' : performance.flips >= 2 ? 'MEDIUM' : 'LOW'

  return {
    score,
    confidence,
    performance,
    rationale: `${performance.flips} flip selesai, ROI ${(performance.roi / 100).toFixed(1)}%${
      performance.averageDaysToSell === null
        ? ''
        : `, rata-rata ${performance.averageDaysToSell} hari`
    }.`,
  }
}

export type OpportunityBand = 'STRONG' | 'GOOD' | 'FAIR' | 'WEAK'

export interface OpportunityScore {
  /** Based primarily on external market data. */
  market: MarketScore
  /** Based on the user's own realised performance. */
  personal: PersonalScore
  /** Both, weighted by evidence. Null when neither side has anything. */
  combined: number | null
  band: OpportunityBand | null
  confidence: MarketConfidence
  /** How much each side contributed, as a percentage, for display. */
  marketShare: number
  personalShare: number
  /** Plain-language explanation of the weighting decision (§39). */
  basis: string
}

export function scoreOpportunity(
  view: MarketView,
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): OpportunityScore {
  const market = scoreMarket(view)
  const performance = personalPerformance(view.ref, motorcycles, entries)
  const personal = scorePersonal(performance)
  const config = OPPORTUNITY_CONFIG

  const marketWeight =
    market.score === null
      ? 0
      : config.marketWeightByConfidence[market.confidence]

  const personalWeight =
    personal.score === null
      ? 0
      : interpolate(config.personalWeightAnchors, performance.flips)

  const totalWeight = marketWeight + personalWeight

  const combined =
    totalWeight === 0
      ? null
      : Math.round(
          ((market.score ?? 0) * marketWeight +
            (personal.score ?? 0) * personalWeight) /
            totalWeight,
        )

  const marketShare =
    totalWeight === 0 ? 0 : Math.round((marketWeight / totalWeight) * 100)

  // The combined figure can be no more trustworthy than its strongest input,
  // and a score resting mostly on an illustration stays an illustration.
  const confidence: MarketConfidence =
    totalWeight === 0
      ? 'NONE'
      : CONFIDENCE_RANK[market.confidence] >= CONFIDENCE_RANK[personal.confidence]
        ? marketWeight >= personalWeight
          ? market.confidence
          : personal.confidence
        : personalWeight >= marketWeight
          ? personal.confidence
          : market.confidence

  let basis: string
  if (totalWeight === 0) {
    basis =
      'Belum ada data pasar maupun riwayat pribadi untuk model ini. Skor gabungan tidak dapat dihitung.'
  } else if (personalWeight === 0) {
    basis =
      'Sepenuhnya dari data pasar — Anda belum punya riwayat flip untuk model ini.'
  } else if (marketWeight === 0) {
    basis =
      'Sepenuhnya dari rekam jejak Anda — data pasar belum tersedia atau masih ilustrasi.'
  } else {
    basis = `${marketShare}% data pasar, ${100 - marketShare}% rekam jejak Anda (${performance.flips} flip).`
  }

  return {
    market,
    personal,
    combined,
    band: opportunityBand(combined),
    confidence,
    marketShare,
    personalShare: 100 - marketShare,
    basis,
  }
}

export function opportunityBand(score: number | null): OpportunityBand | null {
  if (score === null) return null
  const { bands } = OPPORTUNITY_CONFIG
  if (score >= bands.strong) return 'STRONG'
  if (score >= bands.good) return 'GOOD'
  if (score >= bands.fair) return 'FAIR'
  return 'WEAK'
}

export const OPPORTUNITY_BAND_LABELS: Record<OpportunityBand, string> = {
  STRONG: 'PELUANG KUAT',
  GOOD: 'PELUANG BAIK',
  FAIR: 'PELUANG SEDANG',
  WEAK: 'PELUANG LEMAH',
}
