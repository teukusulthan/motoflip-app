/**
 * Inventory ageing, liquidity and performance analytics — §17, §18, §19, §20.
 */
import {
  type BasisPoints,
  type Rupiah,
  ZERO,
  bps,
  ratioToBps,
  sumRupiah,
} from './money'
import { holdingPeriodDays, netProfit, totalCost } from './costing'
import { entriesFor } from './ledger'
import {
  type AcquisitionSource,
  type DomainLedgerEntry,
  type DomainMotorcycle,
  isClosed,
  isInInventory,
} from './types'

// ------------------------------------------------------------------ ageing --

export type AgingBucket = '0-15' | '16-30' | '31-60' | '60+'

export const AGING_BUCKETS: readonly AgingBucket[] = [
  '0-15',
  '16-30',
  '31-60',
  '60+',
]

/** §18 — fixed reporting buckets, independent of the user's warning threshold. */
export function agingBucket(days: number): AgingBucket {
  if (days <= 15) return '0-15'
  if (days <= 30) return '16-30'
  if (days <= 60) return '31-60'
  return '60+'
}

export interface AgingRow {
  motorcycle: DomainMotorcycle
  days: number
  bucket: AgingBucket
  capital: Rupiah
}

export function inventoryAging(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
  asOf: Date = new Date(),
): AgingRow[] {
  return motorcycles
    .filter((m) => isInInventory(m.status))
    .map((m) => {
      const own = entriesFor(m.id, entries)
      const days = holdingPeriodDays(own, asOf) ?? 0
      return {
        motorcycle: m,
        days,
        bucket: agingBucket(days),
        capital: totalCost(own),
      }
    })
    .sort((a, b) => b.days - a.days)
}

export type AgingDistribution = Record<
  AgingBucket,
  { count: number; capital: Rupiah }
>

export function agingDistribution(rows: readonly AgingRow[]): AgingDistribution {
  const distribution: AgingDistribution = {
    '0-15': { count: 0, capital: ZERO },
    '16-30': { count: 0, capital: ZERO },
    '31-60': { count: 0, capital: ZERO },
    '60+': { count: 0, capital: ZERO },
  }

  for (const row of rows) {
    const cell = distribution[row.bucket]
    cell.count += 1
    cell.capital = (cell.capital + row.capital) as Rupiah
  }

  return distribution
}

// --------------------------------------------------------------- liquidity --

/** Mean days-to-sell across completed flips, or null with no history. */
export function averageDaysToSell(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): number | null {
  const durations = motorcycles
    .filter((m) => isClosed(m.status))
    .map((m) => holdingPeriodDays(entriesFor(m.id, entries)))
    .filter((d): d is number => d !== null)

  if (durations.length === 0) return null
  return Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
}

/** Mean holding period of bikes still in inventory. */
export function averageCurrentHolding(rows: readonly AgingRow[]): number | null {
  if (rows.length === 0) return null
  return Math.round(rows.reduce((sum, r) => sum + r.days, 0) / rows.length)
}

// ------------------------------------------------------------- performance --

export interface PerformanceGroup {
  key: string
  label: string
  count: number
  totalCost: Rupiah
  totalRevenue: Rupiah
  netProfit: Rupiah
  roi: BasisPoints | null
  averageDaysToSell: number | null
}

function summarise(
  key: string,
  label: string,
  group: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): PerformanceGroup {
  const costs = sumRupiah(group.map((m) => totalCost(entriesFor(m.id, entries))))
  const profits = sumRupiah(group.map((m) => netProfit(entriesFor(m.id, entries))))

  const durations = group
    .map((m) => holdingPeriodDays(entriesFor(m.id, entries)))
    .filter((d): d is number => d !== null)

  return {
    key,
    label,
    count: group.length,
    totalCost: costs,
    totalRevenue: (costs + profits) as Rupiah,
    netProfit: profits,
    roi: ratioToBps(profits, costs),
    averageDaysToSell:
      durations.length === 0
        ? null
        : Math.round(durations.reduce((a, b) => a + b, 0) / durations.length),
  }
}

function groupBy<T>(items: readonly T[], key: (item: T) => string) {
  const map = new Map<string, T[]>()
  for (const item of items) {
    const k = key(item)
    const existing = map.get(k)
    if (existing) existing.push(item)
    else map.set(k, [item])
  }
  return map
}

/** §19 — which acquisition source actually performs best. */
export function performanceBySource(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): PerformanceGroup[] {
  const closed = motorcycles.filter((m) => isClosed(m.status))
  const grouped = groupBy(closed, (m) => m.acquisitionSource)

  return [...grouped.entries()]
    .map(([source, group]) =>
      summarise(source, SOURCE_LABELS[source as AcquisitionSource] ?? source, group, entries),
    )
    .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))
}

/** §17 — profit and ROI per model, at model+year granularity (§25). */
export function performanceByModel(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): PerformanceGroup[] {
  const closed = motorcycles.filter((m) => isClosed(m.status))
  const grouped = groupBy(closed, (m) => `${m.brand} ${m.model}`.trim())

  return [...grouped.entries()]
    .map(([key, group]) => summarise(key, key, group, entries))
    .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))
}

/** Model + year, used by the Deal Analyzer to find comparable history. */
export function performanceByModelYear(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): PerformanceGroup[] {
  const closed = motorcycles.filter((m) => isClosed(m.status))
  const grouped = groupBy(closed, (m) => `${m.brand} ${m.model} ${m.year}`.trim())

  return [...grouped.entries()]
    .map(([key, group]) => summarise(key, key, group, entries))
    .sort((a, b) => (b.roi ?? -Infinity) - (a.roi ?? -Infinity))
}

/** §20 — vendor spend. */
export interface VendorSpend {
  vendorId: string
  transactions: number
  totalSpend: Rupiah
  averageSpend: Rupiah
}

export function vendorSpend(
  entries: readonly DomainLedgerEntry[],
): VendorSpend[] {
  const relevant = entries.filter(
    (e) => e.voidedAt === null && e.type === 'EXPENSE' && e.vendorId !== null,
  )

  const grouped = groupBy(relevant, (e) => e.vendorId as string)

  return [...grouped.entries()]
    .map(([vendorId, group]) => {
      const total = sumRupiah(group.map((e) => e.amount))
      return {
        vendorId,
        transactions: group.length,
        totalSpend: total,
        averageSpend: (total / BigInt(group.length)) as Rupiah,
      }
    })
    .sort((a, b) => (b.totalSpend > a.totalSpend ? 1 : -1))
}

export const SOURCE_LABELS: Record<AcquisitionSource, string> = {
  FACEBOOK_MARKETPLACE: 'Facebook Marketplace',
  OLX: 'OLX',
  DEALER: 'Dealer',
  DIRECT_OWNER: 'Pemilik Langsung',
  FRIEND: 'Teman',
  WORKSHOP: 'Bengkel',
  AUCTION: 'Lelang',
  INSTAGRAM: 'Instagram',
  OTHER: 'Lainnya',
}

/** Overall ROI across all completed flips — §17. */
export function overallRoi(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): BasisPoints | null {
  const closed = motorcycles.filter((m) => isClosed(m.status))
  const costs = sumRupiah(closed.map((m) => totalCost(entriesFor(m.id, entries))))
  const profits = sumRupiah(closed.map((m) => netProfit(entriesFor(m.id, entries))))
  return ratioToBps(profits, costs)
}

export { bps }
