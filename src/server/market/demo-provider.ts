import 'server-only'
import { rupiah } from '@/domain/money'
import type { MarketModelRef, MarketSnapshot } from '@/domain/market/types'
import type { MarketDataProvider } from './provider'

/**
 * Synthetic market data — §39.
 *
 * This provider exists so the Market screens are demonstrably working before a
 * real data source is connected. Everything it returns is invented, it says so
 * (`isSynthetic`), and every value it produces carries NONE confidence, which
 * the scoring engine propagates and the UI renders as an illustration.
 *
 * It is deterministic: the same model always yields the same series, so the
 * numbers do not shimmer between refreshes and tests are stable.
 */

/** FNV-1a — a small, stable string hash. No crypto strength needed. */
function hash(input: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h >>> 0
}

/** Deterministic pseudo-random in [0, 1) from a seed string. */
function rand(seed: string): number {
  return hash(seed) / 0x100000000
}

const MODEL_BASE_PRICE: Record<string, number> = {
  nmax: 26_000_000,
  aerox: 25_000_000,
  pcx: 31_000_000,
  vario: 20_000_000,
  'vario 125': 17_000_000,
  'vario 160': 27_000_000,
  beat: 12_000_000,
  scoopy: 15_000_000,
  lexi: 19_000_000,
  xmax: 55_000_000,
}

function basePrice(ref: MarketModelRef): number {
  const key = ref.model.toLowerCase()
  const base =
    MODEL_BASE_PRICE[key] ??
    MODEL_BASE_PRICE[key.split(' ')[0] ?? ''] ??
    18_000_000

  // Newer years carry a premium; older years depreciate.
  const currentYear = new Date().getUTCFullYear()
  const age = Math.max(0, currentYear - ref.year)
  return Math.round(base * Math.pow(0.93, age))
}

function startOfMonthUtc(date: Date, monthsAgo: number): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - monthsAgo, 1),
  )
}

export const demoProvider: MarketDataProvider = {
  id: 'demo',
  label: 'Data Demo',
  isSynthetic: true,
  methodology:
    'Data sintetis yang dihasilkan secara deterministik untuk demonstrasi. Bukan data pasar nyata dan tidak boleh dijadikan dasar keputusan pembelian.',

  async getSnapshots(ref, months) {
    const now = new Date()
    const seed = `${ref.brand}|${ref.model}|${ref.year}`.toLowerCase()
    const price = basePrice(ref)

    // A stable per-model demand baseline and trend direction.
    const baseDemand = 45 + Math.floor(rand(`${seed}|demand`) * 40)
    const trend = (rand(`${seed}|trend`) - 0.45) * 9
    const listingBase = 8 + Math.floor(rand(`${seed}|listings`) * 60)
    const speedBase = 12 + Math.floor(rand(`${seed}|speed`) * 35)

    const snapshots: MarketSnapshot[] = []

    for (let i = months - 1; i >= 0; i -= 1) {
      const periodStart = startOfMonthUtc(now, i)
      const step = months - 1 - i
      const jitter = (rand(`${seed}|${step}|j`) - 0.5) * 5

      const demandIndex = Math.max(
        5,
        Math.min(100, Math.round(baseDemand + trend * step + jitter)),
      )

      // Demand nudges price mildly; spread widens on thin demand.
      const demandFactor = 1 + (demandIndex - 65) / 900
      const median = Math.round((price * demandFactor) / 50_000) * 50_000
      const spread = 0.06 + (1 - demandIndex / 100) * 0.10

      snapshots.push({
        periodStart,
        demandIndex,
        listingCount: Math.max(
          2,
          Math.round(listingBase * (1 + (rand(`${seed}|${step}|l`) - 0.5) * 0.4)),
        ),
        medianPrice: rupiah(median),
        p25Price: rupiah(Math.round((median * (1 - spread)) / 50_000) * 50_000),
        p75Price: rupiah(Math.round((median * (1 + spread)) / 50_000) * 50_000),
        avgDaysToSell: Math.max(
          5,
          Math.round(speedBase * (1 - (demandIndex - 50) / 200)),
        ),
        provenance: {
          source: 'DEMO',
          retrievedAt: now,
          // Synthetic data is an illustration, never weak evidence.
          confidence: 'NONE',
          methodology: demoProvider.methodology,
          sampleSize: null,
        },
      })
    }

    return snapshots
  },
}
