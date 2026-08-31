/**
 * Deal Analyzer — §21, §29, §30.
 *
 * The scoring engine is deliberately transparent: every component exposes its
 * own sub-score, weight and a plain-language rationale, and the anchors live in
 * one exported config object rather than being buried in the arithmetic.
 *
 * Honesty rules this module enforces (§29, §30, §39):
 *  - A high projected ROI alone is NOT a good deal. Repair burden and the
 *    user's own track record on the model both pull the score.
 *  - Market signals are not available in this phase. Rather than inventing
 *    them, they are reported as missing and CONFIDENCE IS REDUCED.
 *  - With no comparable history and no market data, the ceiling on confidence
 *    is LOW, and the UI must say why.
 */
import {
  type BasisPoints,
  type Rupiah,
  ZERO,
  addRupiah,
  bps,
  ratioToBps,
  subRupiah,
} from './money'
import { interpolate } from './interpolate'
import { performanceByModel, performanceByModelYear } from './inventory'
import type { DomainLedgerEntry, DomainMotorcycle } from './types'
import type { MarketView } from './market/types'
import { type MarketScore, scoreMarket } from './market/scoring'

export { interpolate }

export interface DealInput {
  brand: string
  model: string
  variant?: string | null
  year: number
  /** What the seller is asking. */
  sellerPrice: Rupiah
  /** What you expect to actually pay after negotiating. */
  expectedPurchase: Rupiah
  estimatedRepair: Rupiah
  expectedSale: Rupiah
}

export interface DealProjection {
  projectedCost: Rupiah
  projectedProfit: Rupiah
  projectedRoi: BasisPoints | null
  /** How much the negotiation is expected to save off the asking price. */
  negotiationSaving: Rupiah
  repairShareBps: BasisPoints | null
}

/** §21 — the arithmetic half. No judgement, just the numbers. */
export function projectDeal(input: DealInput): DealProjection {
  const projectedCost = addRupiah(input.expectedPurchase, input.estimatedRepair)
  const projectedProfit = subRupiah(input.expectedSale, projectedCost)

  return {
    projectedCost,
    projectedProfit,
    projectedRoi: ratioToBps(projectedProfit, projectedCost),
    negotiationSaving: subRupiah(input.sellerPrice, input.expectedPurchase),
    repairShareBps: ratioToBps(input.estimatedRepair, projectedCost),
  }
}

// ------------------------------------------------------------------ config --

/**
 * Scoring anchors. Each is a list of [input, score] points; values between
 * anchors are linearly interpolated, values outside are clamped.
 */
export const DEAL_SCORE_CONFIG = {
  weights: {
    roi: 35,
    margin: 18,
    history: 22,
    repairRisk: 13,
    /** §30 — how the deal's own prices sit against the wider market. */
    marketAlignment: 12,
  },
  /**
   * Discount of the expected purchase against the market's 25th percentile,
   * in bps. Buying below what the market is already asking is the edge.
   */
  buyVsMarketAnchors: [
    [-1500, 0],
    [-500, 25],
    [0, 55],
    [500, 78],
    [1200, 95],
    [2500, 100],
  ] as ReadonlyArray<readonly [number, number]>,
  /**
   * Expected sale against the market median, in bps. Selling at or slightly
   * below the median is realistic; well above it is wishful.
   */
  sellVsMarketAnchors: [
    [-1500, 90],
    [-500, 100],
    [0, 92],
    [500, 65],
    [1200, 30],
    [2500, 0],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Projected ROI in basis points → sub-score. */
  roiAnchors: [
    [0, 0],
    [500, 30],
    [1000, 55],
    [1500, 80],
    [2000, 95],
    [3000, 100],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Absolute projected profit in rupiah → sub-score. */
  marginAnchors: [
    [0, 0],
    [1_000_000, 30],
    [2_000_000, 55],
    [3_000_000, 78],
    [5_000_000, 95],
    [8_000_000, 100],
  ] as ReadonlyArray<readonly [number, number]>,
  /**
   * Repair as a share of total cost, in basis points → sub-score.
   * A cheap bike needing heavy work is where flips go wrong.
   */
  repairShareAnchors: [
    [0, 100],
    [500, 88],
    [1000, 70],
    [1500, 50],
    [2500, 25],
    [4000, 0],
  ] as ReadonlyArray<readonly [number, number]>,
  /**
   * Projected ROI relative to the user's own historical ROI on the model,
   * expressed as a ratio in basis points (10000 = exactly matches history).
   */
  historyAnchors: [
    [0, 10],
    [5000, 35],
    [8000, 60],
    [10000, 80],
    [13000, 95],
    [18000, 100],
  ] as ReadonlyArray<readonly [number, number]>,
  bands: {
    strongBuy: 78,
    consider: 60,
    marginal: 42,
  },
} as const

// ------------------------------------------------------------------- score --

export type DealBand = 'STRONG_BUY' | 'CONSIDER' | 'MARGINAL' | 'AVOID'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ScoreComponent {
  key: 'roi' | 'margin' | 'history' | 'repairRisk' | 'marketAlignment'
  label: string
  score: number | null
  weight: number
  rationale: string
}

export interface PersonalHistory {
  /** Completed flips matching brand+model+year. */
  matchingYearCount: number
  /** Completed flips matching brand+model, any year. */
  matchingModelCount: number
  averageRoi: BasisPoints | null
  averageDaysToSell: number | null
  label: string | null
}

export interface MarketContext {
  score: MarketScore
  /** Whether the market data was allowed to influence the score. */
  counted: boolean
}

export interface DealScoreResult {
  score: number
  band: DealBand
  confidence: Confidence
  components: ScoreComponent[]
  history: PersonalHistory
  /** Signals the score could NOT use — surfaced verbatim in the UI (§39). */
  missingSignals: string[]
  projection: DealProjection
  market: MarketContext | null
}

/** Pull the user's own track record for the model being analysed. */
export function personalHistory(
  input: Pick<DealInput, 'brand' | 'model' | 'year'>,
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): PersonalHistory {
  const yearKey = `${input.brand} ${input.model} ${input.year}`.trim()
  const modelKey = `${input.brand} ${input.model}`.trim()

  const byYear = performanceByModelYear(motorcycles, entries).find(
    (g) => g.key.toLowerCase() === yearKey.toLowerCase(),
  )
  const byModel = performanceByModel(motorcycles, entries).find(
    (g) => g.key.toLowerCase() === modelKey.toLowerCase(),
  )

  // Prefer same-year history (§25), fall back to the model across all years.
  const preferred = byYear ?? byModel

  return {
    matchingYearCount: byYear?.count ?? 0,
    matchingModelCount: byModel?.count ?? 0,
    averageRoi: preferred?.roi ?? null,
    averageDaysToSell: preferred?.averageDaysToSell ?? null,
    label: byYear ? yearKey : byModel ? modelKey : null,
  }
}

const fmtPct = (b: BasisPoints | null) =>
  b === null ? '—' : `${(b / 100).toFixed(1)}%`

export function scoreDeal(
  input: DealInput,
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
  /**
   * §30 — optional market context for the model being analysed.
   *
   * Synthetic market data is shown but NEVER counted: an illustration must not
   * move a number the user might buy on.
   */
  marketView?: MarketView | null,
): DealScoreResult {
  const projection = projectDeal(input)
  const history = personalHistory(input, motorcycles, entries)
  const config = DEAL_SCORE_CONFIG

  const marketScore = marketView ? scoreMarket(marketView) : null
  const marketCounted =
    marketScore !== null && marketScore.confidence !== 'NONE'

  const components: ScoreComponent[] = []

  // 1. Projected ROI
  components.push({
    key: 'roi',
    label: 'ROI Proyeksi',
    score:
      projection.projectedRoi === null
        ? null
        : interpolate(config.roiAnchors, projection.projectedRoi),
    weight: config.weights.roi,
    rationale:
      projection.projectedRoi === null
        ? 'Biaya proyeksi nol — ROI tidak terdefinisi.'
        : `ROI proyeksi ${fmtPct(projection.projectedRoi)}.`,
  })

  // 2. Absolute margin
  components.push({
    key: 'margin',
    label: 'Margin Absolut',
    score: interpolate(config.marginAnchors, Number(projection.projectedProfit)),
    weight: config.weights.margin,
    rationale: `Perkiraan laba bersih ${projection.projectedProfit < ZERO ? 'negatif' : 'positif'}.`,
  })

  // 3. Personal track record on this model
  const hasHistory = history.averageRoi !== null && history.averageRoi > 0
  components.push({
    key: 'history',
    label: 'Rekam Jejak Anda',
    score:
      hasHistory && projection.projectedRoi !== null
        ? interpolate(
            config.historyAnchors,
            (projection.projectedRoi / (history.averageRoi as number)) * 10_000,
          )
        : null,
    weight: config.weights.history,
    rationale: hasHistory
      ? `Rata-rata ROI Anda untuk ${history.label}: ${fmtPct(history.averageRoi)} dari ${
          history.matchingYearCount || history.matchingModelCount
        } unit terjual.`
      : 'Belum ada riwayat penjualan untuk model ini — komponen ini tidak dinilai.',
  })

  // 4. Repair burden
  components.push({
    key: 'repairRisk',
    label: 'Risiko Perbaikan',
    score:
      projection.repairShareBps === null
        ? null
        : interpolate(config.repairShareAnchors, projection.repairShareBps),
    weight: config.weights.repairRisk,
    rationale:
      projection.repairShareBps === null
        ? 'Tidak dapat dihitung.'
        : `Perbaikan ${fmtPct(projection.repairShareBps)} dari total biaya.`,
  })

  // 5. Market alignment — how this deal's prices sit against the market (§30).
  const buyReference = marketScore?.estimatedBuyPrice ?? null
  const sellReference = marketScore?.medianPrice ?? null

  const buyDiscountBps =
    marketCounted && buyReference !== null && buyReference > 0n
      ? ratioToBps(
          subRupiah(buyReference, input.expectedPurchase),
          buyReference,
        )
      : null

  const sellPremiumBps =
    marketCounted && sellReference !== null && sellReference > 0n
      ? ratioToBps(subRupiah(input.expectedSale, sellReference), sellReference)
      : null

  const alignmentScore =
    buyDiscountBps === null && sellPremiumBps === null
      ? null
      : ((buyDiscountBps === null
          ? 50
          : interpolate(config.buyVsMarketAnchors, buyDiscountBps)) +
          (sellPremiumBps === null
            ? 50
            : interpolate(config.sellVsMarketAnchors, sellPremiumBps))) /
        2

  components.push({
    key: 'marketAlignment',
    label: 'Kesesuaian Pasar',
    score: alignmentScore,
    weight: config.weights.marketAlignment,
    rationale:
      alignmentScore === null
        ? marketScore === null
          ? 'Model ini belum dipantau di halaman Pasar.'
          : 'Data pasar untuk model ini masih ilustrasi, jadi tidak diperhitungkan.'
        : `Beli ${describeGap(buyDiscountBps, 'di bawah', 'di atas')} harga pasar bawah; jual ${describeGap(
            sellPremiumBps === null ? null : bps(-sellPremiumBps),
            'di bawah',
            'di atas',
          )} harga tengah pasar.`,
  })

  // Weighted mean over the components that could actually be scored. Weights
  // are renormalised so a missing component does not silently score zero.
  const scored = components.filter(
    (c): c is ScoreComponent & { score: number } => c.score !== null,
  )
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0)
  const score =
    totalWeight === 0
      ? 0
      : Math.round(
          scored.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight,
        )

  // §39 — name every signal the score could not use.
  const missingSignals: string[] = []
  if (marketScore === null) {
    missingSignals.push(
      'Model ini belum dipantau — tambahkan di halaman Pasar untuk memakai data pasar',
    )
  } else if (!marketCounted) {
    missingSignals.push(
      'Data pasar untuk model ini masih ilustrasi, sehingga tidak memengaruhi skor',
    )
  }
  if (!hasHistory) {
    missingSignals.push('Belum ada riwayat flip Anda untuk model ini')
  }

  /**
   * Confidence reflects evidence, not enthusiasm.
   *
   * HIGH requires BOTH a real market signal and a real personal track record;
   * neither alone is enough to be highly confident about a purchase.
   */
  let confidence: Confidence
  if (marketCounted && history.matchingYearCount >= 3) confidence = 'HIGH'
  else if (marketCounted || history.matchingYearCount >= 3) confidence = 'MEDIUM'
  else confidence = 'LOW'

  const band: DealBand =
    projection.projectedProfit <= ZERO
      ? 'AVOID'
      : score >= config.bands.strongBuy
        ? 'STRONG_BUY'
        : score >= config.bands.consider
          ? 'CONSIDER'
          : score >= config.bands.marginal
            ? 'MARGINAL'
            : 'AVOID'

  return {
    score,
    band,
    confidence,
    components,
    history,
    missingSignals,
    projection,
    market:
      marketScore === null
        ? null
        : { score: marketScore, counted: marketCounted },
  }
}

/** "5,2% di bawah" / "3,1% di atas" / "sesuai" */
function describeGap(
  bps: BasisPoints | null,
  below: string,
  above: string,
): string {
  if (bps === null) return 'sesuai'
  if (bps === 0) return 'tepat di'
  const magnitude = `${Math.abs(bps / 100).toFixed(1)}%`
  return `${magnitude} ${bps > 0 ? below : above}`
}

export const BAND_LABELS: Record<DealBand, string> = {
  STRONG_BUY: 'PELUANG KUAT',
  CONSIDER: 'LAYAK DIPERTIMBANGKAN',
  MARGINAL: 'MARGIN TIPIS',
  AVOID: 'HINDARI',
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  HIGH: 'TINGGI',
  MEDIUM: 'SEDANG',
  LOW: 'RENDAH',
}
