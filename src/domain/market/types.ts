/**
 * Market intelligence domain types — §22, §39.
 *
 * Every market value carries its provenance. This is not decoration: §39
 * requires that source, timestamp, confidence and methodology travel with the
 * data, and the only way to guarantee that at the UI is to make it impossible
 * to hold a value without them.
 */
import type { Rupiah } from '../money'

export type MarketSource = 'DEMO' | 'MANUAL' | 'EXTERNAL'

/**
 * Confidence in a market figure.
 *
 * `NONE` exists specifically so synthetic data has somewhere honest to sit.
 * Demo values are illustrations, not weak evidence, and the distinction must
 * survive all the way to the screen.
 */
export type MarketConfidence = 'NONE' | 'LOW' | 'MEDIUM' | 'HIGH'

export const CONFIDENCE_RANK: Record<MarketConfidence, number> = {
  NONE: 0,
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
}

export const CONFIDENCE_LABELS: Record<MarketConfidence, string> = {
  NONE: 'ILUSTRASI',
  LOW: 'RENDAH',
  MEDIUM: 'SEDANG',
  HIGH: 'TINGGI',
}

/** The weakest confidence among several inputs governs the result. */
export function weakestConfidence(
  values: readonly MarketConfidence[],
): MarketConfidence {
  if (values.length === 0) return 'NONE'
  return values.reduce((weakest, current) =>
    CONFIDENCE_RANK[current] < CONFIDENCE_RANK[weakest] ? current : weakest,
  )
}

export interface Provenance {
  source: MarketSource
  retrievedAt: Date
  confidence: MarketConfidence
  methodology: string
  sampleSize: number | null
}

export const isSynthetic = (provenance: Provenance): boolean =>
  provenance.source === 'DEMO'

/** Identity of a tracked model, at model+year granularity (§25). */
export interface MarketModelRef {
  id: string
  brand: string
  model: string
  variant: string | null
  year: number
}

export const marketModelLabel = (ref: MarketModelRef): string =>
  [ref.brand, ref.model, ref.variant, ref.year].filter(Boolean).join(' ')

/** One month of aggregated signals for a model — §26. */
export interface MarketSnapshot {
  periodStart: Date
  demandIndex: number | null
  listingCount: number | null
  medianPrice: Rupiah | null
  p25Price: Rupiah | null
  p75Price: Rupiah | null
  avgDaysToSell: number | null
  provenance: Provenance
}

/** A single listing observed by the user. */
export interface MarketObservation {
  id: string
  observedAt: Date
  askingPrice: Rupiah
  mileage: number | null
  listingAgeDays: number | null
}

/**
 * Everything known about one model, assembled from every available source.
 * This is the input to scoring.
 */
export interface MarketView {
  ref: MarketModelRef
  /** Oldest first. */
  history: MarketSnapshot[]
  observations: MarketObservation[]
  provenance: Provenance
}

export const latestSnapshot = (view: MarketView): MarketSnapshot | null =>
  view.history.length === 0 ? null : (view.history[view.history.length - 1] ?? null)
