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
  ratioToBps,
  subRupiah,
} from './money'
import { performanceByModel, performanceByModelYear } from './inventory'
import type { DomainLedgerEntry, DomainMotorcycle } from './types'

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
    roi: 40,
    margin: 20,
    history: 25,
    repairRisk: 15,
  },
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

/** Piecewise-linear interpolation across anchor points, clamped at both ends. */
export function interpolate(
  anchors: ReadonlyArray<readonly [number, number]>,
  value: number,
): number {
  const first = anchors[0]
  const last = anchors[anchors.length - 1]
  if (!first || !last) return 0
  if (value <= first[0]) return first[1]
  if (value >= last[0]) return last[1]

  for (let i = 0; i < anchors.length - 1; i += 1) {
    const lo = anchors[i]
    const hi = anchors[i + 1]
    if (!lo || !hi) continue
    if (value >= lo[0] && value <= hi[0]) {
      const span = hi[0] - lo[0]
      if (span === 0) return hi[1]
      const t = (value - lo[0]) / span
      return lo[1] + t * (hi[1] - lo[1])
    }
  }
  return last[1]
}

// ------------------------------------------------------------------- score --

export type DealBand = 'STRONG_BUY' | 'CONSIDER' | 'MARGINAL' | 'AVOID'
export type Confidence = 'HIGH' | 'MEDIUM' | 'LOW'

export interface ScoreComponent {
  key: 'roi' | 'margin' | 'history' | 'repairRisk'
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

export interface DealScoreResult {
  score: number
  band: DealBand
  confidence: Confidence
  components: ScoreComponent[]
  history: PersonalHistory
  /** Signals the score could NOT use — surfaced verbatim in the UI (§39). */
  missingSignals: string[]
  projection: DealProjection
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
): DealScoreResult {
  const projection = projectDeal(input)
  const history = personalHistory(input, motorcycles, entries)
  const config = DEAL_SCORE_CONFIG

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

  // §30 — market data is not available in this phase. Say so, don't fake it.
  const missingSignals: string[] = [
    'Data pasar eksternal (permintaan, likuiditas, harga pasar) belum tersedia',
  ]
  if (!hasHistory) {
    missingSignals.push('Belum ada riwayat flip Anda untuk model ini')
  }

  // Confidence is capped by how much real evidence went into the score.
  let confidence: Confidence
  if (history.matchingYearCount >= 3) confidence = 'MEDIUM'
  else if (history.matchingYearCount >= 1 || history.matchingModelCount >= 2)
    confidence = 'LOW'
  else confidence = 'LOW'

  // Without any market signal, HIGH is unreachable by construction (§29/§30).

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
  }
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
