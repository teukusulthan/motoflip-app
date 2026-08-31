import 'server-only'
import { prisma } from '@/lib/prisma'
import { rupiah } from '@/domain/money'
import type {
  MarketModelRef,
  MarketObservation,
  MarketSnapshot,
  MarketView,
  Provenance,
} from '@/domain/market/types'
import { weakestConfidence } from '@/domain/market/types'
import { snapshotsFromObservations } from '@/server/market/manual-provider'
import { demoProvider } from '@/server/market/demo-provider'
import { registerProvider, activeProviderId, getProvider } from '@/server/market/provider'

registerProvider(demoProvider)

export const HISTORY_MONTHS = 6

export async function getMarketModels(userId: string) {
  return prisma.marketModel.findMany({
    where: { userId },
    orderBy: [{ brand: 'asc' }, { model: 'asc' }, { year: 'desc' }],
  })
}

export async function getMarketModel(userId: string, id: string) {
  return prisma.marketModel.findFirst({ where: { id, userId } })
}

export async function getWatchlistIds(userId: string): Promise<Set<string>> {
  const rows = await prisma.watchlistItem.findMany({
    where: { userId },
    select: { marketModelId: true },
  })
  return new Set(rows.map((r) => r.marketModelId))
}

function toRef(row: {
  id: string
  brand: string
  model: string
  variant: string | null
  year: number
}): MarketModelRef {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    variant: row.variant,
    year: row.year,
  }
}

/**
 * Assemble everything known about one model.
 *
 * User observations take precedence over provider snapshots for any month they
 * cover: real evidence always outranks a provider's estimate, and it outranks
 * synthetic data absolutely.
 */
export async function getMarketView(
  userId: string,
  row: {
    id: string
    brand: string
    model: string
    variant: string | null
    year: number
  },
): Promise<MarketView> {
  const ref = toRef(row)

  const observationRows = await prisma.marketObservation.findMany({
    where: { userId, marketModelId: row.id },
    orderBy: { observedAt: 'asc' },
  })

  const observations: MarketObservation[] = observationRows.map((o) => ({
    id: o.id,
    observedAt: o.observedAt,
    askingPrice: rupiah(o.askingPrice),
    mileage: o.mileage,
    listingAgeDays: o.listingAgeDays,
  }))

  const manual = snapshotsFromObservations(observations)

  const provider = getProvider(activeProviderId())
  const synthetic = provider
    ? await provider.getSnapshots(ref, HISTORY_MONTHS)
    : []

  // Merge by month, preferring real observations.
  const byMonth = new Map<number, MarketSnapshot>()
  for (const snapshot of synthetic) {
    byMonth.set(snapshot.periodStart.getTime(), snapshot)
  }
  for (const snapshot of manual) {
    byMonth.set(snapshot.periodStart.getTime(), snapshot)
  }

  const history = [...byMonth.values()].sort(
    (a, b) => a.periodStart.getTime() - b.periodStart.getTime(),
  )

  const provenance = combineProvenance(history)

  return { ref, history, observations, provenance }
}

/**
 * The provenance of a merged series is governed by its weakest contributor:
 * a history that is mostly synthetic is a synthetic history.
 */
function combineProvenance(history: readonly MarketSnapshot[]): Provenance {
  if (history.length === 0) {
    return {
      source: 'DEMO',
      retrievedAt: new Date(),
      confidence: 'NONE',
      methodology: 'Belum ada data untuk model ini.',
      sampleSize: null,
    }
  }

  const latest = history[history.length - 1] as MarketSnapshot
  const manualCount = history.filter(
    (s) => s.provenance.source === 'MANUAL',
  ).length

  // Only when observations dominate the series does it stop being an
  // illustration; a single real month against five demo months is not enough.
  const mostlyReal = manualCount * 2 > history.length

  const confidence = mostlyReal
    ? weakestConfidence(
        history
          .filter((s) => s.provenance.source === 'MANUAL')
          .map((s) => s.provenance.confidence),
      )
    : 'NONE'

  const sampleSize = history.reduce(
    (sum, s) => sum + (s.provenance.sampleSize ?? 0),
    0,
  )

  return {
    source: mostlyReal ? 'MANUAL' : latest.provenance.source,
    retrievedAt: latest.provenance.retrievedAt,
    confidence,
    methodology: mostlyReal
      ? 'Sebagian besar dihitung dari listing yang Anda catat sendiri.'
      : `Sebagian besar data masih ilustrasi. ${latest.provenance.methodology}`,
    sampleSize: sampleSize === 0 ? null : sampleSize,
  }
}

export async function getMarketViews(userId: string): Promise<MarketView[]> {
  const rows = await getMarketModels(userId)
  return Promise.all(rows.map((row) => getMarketView(userId, row)))
}

export async function getObservations(userId: string, marketModelId: string) {
  return prisma.marketObservation.findMany({
    where: { userId, marketModelId },
    orderBy: { observedAt: 'desc' },
    take: 50,
  })
}

/** The provider currently in use, for the UI's provenance banner. */
export function activeProvider() {
  return getProvider(activeProviderId())
}
