/**
 * Market Trend Score — §23.
 *
 * A transparent, configurable scoring engine: every component exposes its own
 * sub-score, weight, rationale and provenance, and the anchors live in one
 * exported config rather than being buried in arithmetic.
 *
 * §29 is the rule this module exists to obey: rising demand is NOT by itself a
 * good flip. Demand carries less weight than liquidity and profit potential
 * combined, and a model with strong demand but heavy competition or a thin
 * spread cannot score highly.
 */
import { type BasisPoints, type Rupiah, ratioToBps } from '../money'
import { interpolate } from '../interpolate'
import {
  type MarketConfidence,
  type MarketView,
  type Provenance,
  latestSnapshot,
  weakestConfidence,
} from './types'

export const MARKET_SCORE_CONFIG = {
  weights: {
    demand: 22,
    priceStability: 18,
    liquidity: 22,
    competition: 15,
    profitPotential: 23,
  },
  /** Demand index 0–100 → sub-score. */
  demandAnchors: [
    [0, 0],
    [30, 20],
    [50, 45],
    [70, 72],
    [85, 90],
    [100, 100],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Month-over-month demand growth in basis points → bonus/penalty points. */
  demandGrowthAnchors: [
    [-3000, -25],
    [-1000, -12],
    [0, 0],
    [1000, 10],
    [2500, 20],
    [5000, 25],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Interquartile spread as a share of median, in bps → stability sub-score. */
  priceSpreadAnchors: [
    [0, 100],
    [500, 92],
    [1200, 75],
    [2000, 55],
    [3000, 30],
    [4500, 0],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Average days to sell → liquidity sub-score. */
  daysToSellAnchors: [
    [7, 100],
    [14, 90],
    [21, 75],
    [30, 55],
    [45, 30],
    [75, 0],
  ] as ReadonlyArray<readonly [number, number]>,
  /** Listings on the market → competition sub-score (fewer is better). */
  listingCountAnchors: [
    [0, 100],
    [10, 88],
    [25, 70],
    [50, 48],
    [90, 22],
    [150, 0],
  ] as ReadonlyArray<readonly [number, number]>,
  /**
   * Spread between the 25th percentile (a realistic buy) and the median
   * (a realistic sell), as a share of the buy price, in bps → profit sub-score.
   */
  marginAnchors: [
    [0, 0],
    [500, 22],
    [1000, 48],
    [1500, 72],
    [2200, 92],
    [3000, 100],
  ] as ReadonlyArray<readonly [number, number]>,
  bands: {
    strong: 78,
    moderate: 60,
    weak: 42,
  },
} as const

export type MarketComponentKey =
  | 'demand'
  | 'priceStability'
  | 'liquidity'
  | 'competition'
  | 'profitPotential'

export interface MarketComponent {
  key: MarketComponentKey
  label: string
  score: number | null
  weight: number
  rationale: string
}

export interface MarketScore {
  score: number | null
  confidence: MarketConfidence
  components: MarketComponent[]
  provenance: Provenance
  /** Signals that were unavailable, named verbatim for the UI (§39). */
  missingSignals: string[]
  demandGrowthBps: BasisPoints | null
  medianPrice: Rupiah | null
  estimatedBuyPrice: Rupiah | null
  avgDaysToSell: number | null
  listingCount: number | null
}

const clamp = (value: number) => Math.max(0, Math.min(100, value))

/**
 * Month-over-month demand growth, comparing the newest snapshot to the one
 * before it. Returns null with fewer than two snapshots — a single reading is
 * not a trend, and pretending otherwise is exactly the fake precision §30
 * warns against.
 */
export function demandGrowthBps(view: MarketView): BasisPoints | null {
  const history = view.history.filter((s) => s.demandIndex !== null)
  if (history.length < 2) return null

  const latest = history[history.length - 1]
  const previous = history[history.length - 2]
  if (!latest?.demandIndex || !previous?.demandIndex) return null
  if (previous.demandIndex === 0) return null

  return Math.round(
    ((latest.demandIndex - previous.demandIndex) / previous.demandIndex) * 10_000,
  ) as BasisPoints
}

/**
 * Whether demand has risen consistently, not merely in the last month — §24's
 * "Rising Demand" list, which must not be satisfied by a single lucky spike.
 */
export function hasSustainedGrowth(view: MarketView, months = 3): boolean {
  const series = view.history
    .filter((s) => s.demandIndex !== null)
    .slice(-(months + 1))
  if (series.length < months + 1) return false

  for (let i = 1; i < series.length; i += 1) {
    const previous = series[i - 1]?.demandIndex
    const current = series[i]?.demandIndex
    if (previous === null || previous === undefined) return false
    if (current === null || current === undefined) return false
    if (current <= previous) return false
  }
  return true
}

/** A realistic acquisition price: the 25th percentile of current listings. */
export function estimatedBuyPrice(view: MarketView): Rupiah | null {
  return latestSnapshot(view)?.p25Price ?? null
}

export function scoreMarket(view: MarketView): MarketScore {
  const snapshot = latestSnapshot(view)
  const config = MARKET_SCORE_CONFIG
  const components: MarketComponent[] = []
  const missingSignals: string[] = []

  const growth = demandGrowthBps(view)

  // 1. Demand level, adjusted by its own trend.
  const demandIndex = snapshot?.demandIndex ?? null
  if (demandIndex === null) {
    missingSignals.push('Indeks permintaan')
  }
  components.push({
    key: 'demand',
    label: 'Permintaan',
    score:
      demandIndex === null
        ? null
        : clamp(
            interpolate(config.demandAnchors, demandIndex) +
              (growth === null
                ? 0
                : interpolate(config.demandGrowthAnchors, growth)),
          ),
    weight: config.weights.demand,
    rationale:
      demandIndex === null
        ? 'Tidak ada data permintaan.'
        : growth === null
          ? `Indeks permintaan ${demandIndex}. Belum cukup riwayat untuk menilai tren.`
          : `Indeks permintaan ${demandIndex}, ${growth >= 0 ? 'naik' : 'turun'} ${Math.abs(growth / 100).toFixed(1)}% dari bulan lalu.`,
  })

  // 2. Price stability, from the interquartile spread.
  const spreadBps =
    snapshot?.medianPrice && snapshot.p25Price && snapshot.p75Price
      ? ratioToBps(
          (snapshot.p75Price - snapshot.p25Price) as Rupiah,
          snapshot.medianPrice,
        )
      : null
  if (spreadBps === null) missingSignals.push('Sebaran harga pasar')
  components.push({
    key: 'priceStability',
    label: 'Stabilitas Harga',
    score:
      spreadBps === null
        ? null
        : clamp(interpolate(config.priceSpreadAnchors, spreadBps)),
    weight: config.weights.priceStability,
    rationale:
      spreadBps === null
        ? 'Tidak ada sebaran harga.'
        : `Rentang harga ${(spreadBps / 100).toFixed(0)}% dari harga tengah.`,
  })

  // 3. Liquidity.
  const days = snapshot?.avgDaysToSell ?? null
  if (days === null) missingSignals.push('Kecepatan jual')
  components.push({
    key: 'liquidity',
    label: 'Likuiditas',
    score:
      days === null ? null : clamp(interpolate(config.daysToSellAnchors, days)),
    weight: config.weights.liquidity,
    rationale:
      days === null
        ? 'Tidak ada data kecepatan jual.'
        : `Rata-rata terjual dalam ${days} hari.`,
  })

  // 4. Competition — many listings means you are one seller among many.
  const listings = snapshot?.listingCount ?? null
  if (listings === null) missingSignals.push('Jumlah listing')
  components.push({
    key: 'competition',
    label: 'Persaingan',
    score:
      listings === null
        ? null
        : clamp(interpolate(config.listingCountAnchors, listings)),
    weight: config.weights.competition,
    rationale:
      listings === null
        ? 'Tidak ada data jumlah listing.'
        : `${listings} unit sedang dijual.`,
  })

  // 5. Profit potential — the gap between a realistic buy and a realistic sell.
  const buy = snapshot?.p25Price ?? null
  const sell = snapshot?.medianPrice ?? null
  const marginBps =
    buy !== null && sell !== null && buy > 0n
      ? ratioToBps((sell - buy) as Rupiah, buy)
      : null
  if (marginBps === null) missingSignals.push('Potensi margin')
  components.push({
    key: 'profitPotential',
    label: 'Potensi Profit',
    score:
      marginBps === null
        ? null
        : clamp(interpolate(config.marginAnchors, marginBps)),
    weight: config.weights.profitPotential,
    rationale:
      marginBps === null
        ? 'Tidak ada data harga untuk menghitung margin.'
        : `Selisih beli-jual sekitar ${(marginBps / 100).toFixed(1)}% sebelum biaya.`,
  })

  const scored = components.filter(
    (c): c is MarketComponent & { score: number } => c.score !== null,
  )
  const totalWeight = scored.reduce((sum, c) => sum + c.weight, 0)

  const score =
    totalWeight === 0
      ? null
      : Math.round(
          scored.reduce((sum, c) => sum + c.score * c.weight, 0) / totalWeight,
        )

  // Confidence can never exceed the weakest source that fed the score, and a
  // score built from fewer than half the components is downgraded further.
  // With no score at all there is nothing to be confident about: reporting LOW
  // rather than NONE would imply weak evidence where there is none.
  const coverage = totalWeight / 100
  let confidence: MarketConfidence
  if (score === null) {
    confidence = 'NONE'
  } else {
    confidence = weakestConfidence([view.provenance.confidence])
    if (coverage < 0.5 && confidence !== 'NONE') confidence = 'LOW'
  }

  return {
    score,
    confidence,
    components,
    provenance: view.provenance,
    missingSignals,
    demandGrowthBps: growth,
    medianPrice: sell,
    estimatedBuyPrice: buy,
    avgDaysToSell: days,
    listingCount: listings,
  }
}

export type MarketBand = 'STRONG' | 'MODERATE' | 'WEAK' | 'POOR'

export function marketBand(score: number | null): MarketBand | null {
  if (score === null) return null
  const { bands } = MARKET_SCORE_CONFIG
  if (score >= bands.strong) return 'STRONG'
  if (score >= bands.moderate) return 'MODERATE'
  if (score >= bands.weak) return 'WEAK'
  return 'POOR'
}

export const MARKET_BAND_LABELS: Record<MarketBand, string> = {
  STRONG: 'PASAR KUAT',
  MODERATE: 'PASAR SEDANG',
  WEAK: 'PASAR LEMAH',
  POOR: 'PASAR BURUK',
}
