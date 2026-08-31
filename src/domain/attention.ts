/**
 * Attention rules — §4.
 *
 * These generate the home screen's "needs your attention" list. Each rule is a
 * pure function of the data plus the user's configured thresholds, so the home
 * screen never contains business logic (§48).
 */
import { differenceInCalendarDays } from './dates'
import { type BasisPoints, type Rupiah, ratioToBps } from './money'
import { costBreakdown, expectedOutcome, holdingPeriodDays } from './costing'
import { entriesFor } from './ledger'
import { averageDaysToSell } from './inventory'
import { type DomainLedgerEntry, type DomainMotorcycle, isInInventory } from './types'

export type AttentionSeverity = 'info' | 'warning' | 'danger'

export type AttentionKind =
  | 'AGING'
  | 'REPAIR_OVERRUN'
  | 'LOW_MARGIN'
  | 'NOT_LISTED'
  | 'LISTED_TOO_LONG'
  | 'DOCUMENT_EXPIRING'

export interface AttentionItem {
  id: string
  kind: AttentionKind
  severity: AttentionSeverity
  motorcycleId: string | null
  title: string
  detail: string
}

export interface AttentionThresholds {
  agingWarnDays: number
  agingCriticalDays: number
  repairOverrunWarnBps: number
  lowMarginWarnBps: number
  /** Days after listing before "listed too long" fires. */
  listedTooLongDays: number
  /** Days of notice before a document expires. */
  documentExpiryNoticeDays: number
}

export const DEFAULT_THRESHOLDS: AttentionThresholds = {
  agingWarnDays: 30,
  agingCriticalDays: 60,
  repairOverrunWarnBps: 2000,
  lowMarginWarnBps: 1000,
  listedTooLongDays: 21,
  documentExpiryNoticeDays: 30,
}

export interface ExpiringDocument {
  id: string
  motorcycleId: string
  label: string
  expiresAt: Date
}

const bikeName = (m: DomainMotorcycle) =>
  [m.brand, m.model, m.variant, m.year].filter(Boolean).join(' ')

export function buildAttentionItems(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
  documents: readonly ExpiringDocument[],
  thresholds: AttentionThresholds = DEFAULT_THRESHOLDS,
  asOf: Date = new Date(),
): AttentionItem[] {
  const items: AttentionItem[] = []
  const personalAverage = averageDaysToSell(motorcycles, entries)

  for (const bike of motorcycles) {
    if (!isInInventory(bike.status)) continue

    const own = entriesFor(bike.id, entries)
    const days = holdingPeriodDays(own, asOf)
    const name = bikeName(bike)

    // 1. Too long in inventory
    if (days !== null && days >= thresholds.agingWarnDays) {
      items.push({
        id: `aging:${bike.id}`,
        kind: 'AGING',
        severity: days >= thresholds.agingCriticalDays ? 'danger' : 'warning',
        motorcycleId: bike.id,
        title: `${name} — ${days} hari di inventori`,
        detail:
          personalAverage === null
            ? 'Melebihi ambang batas yang Anda tetapkan.'
            : `Rata-rata Anda: ${personalAverage} hari.`,
      })
    }

    // 2. Repair spending over budget
    const budget = bike.projectedRepairCost
    if (budget !== null && budget > 0n) {
      const spent = costBreakdown(own).REPAIR
      if (spent > budget) {
        const overrun = ratioToBps((spent - budget) as Rupiah, budget)
        if (overrun !== null && overrun >= thresholds.repairOverrunWarnBps) {
          items.push({
            id: `repair:${bike.id}`,
            kind: 'REPAIR_OVERRUN',
            severity: 'warning',
            motorcycleId: bike.id,
            title: `${name} — biaya perbaikan melebihi estimasi`,
            detail: `Realisasi ${(overrun / 100).toFixed(0)}% di atas anggaran perbaikan.`,
          })
        }
      }
    }

    // 3. Thin expected margin
    const expected = expectedOutcome(bike, own)
    if (
      expected?.expectedRoi !== undefined &&
      expected?.expectedRoi !== null &&
      expected.expectedRoi < thresholds.lowMarginWarnBps
    ) {
      items.push({
        id: `margin:${bike.id}`,
        kind: 'LOW_MARGIN',
        severity: expected.expectedRoi < 0 ? 'danger' : 'warning',
        motorcycleId: bike.id,
        title: `${name} — margin tipis`,
        detail: `Perkiraan ROI ${(expected.expectedRoi / 100).toFixed(1)}% terhadap target jual.`,
      })
    }

    // 4. Ready but not listed
    if (bike.status === 'READY_TO_SELL' && bike.listedAt === null) {
      items.push({
        id: `unlisted:${bike.id}`,
        kind: 'NOT_LISTED',
        severity: 'info',
        motorcycleId: bike.id,
        title: `${name} — siap jual tapi belum diiklankan`,
        detail: 'Motor sudah siap namun belum dipasang di marketplace.',
      })
    }

    // 5. Listed a long time without selling
    if (bike.listedAt !== null) {
      const listedDays = differenceInCalendarDays(bike.listedAt, asOf)
      if (listedDays >= thresholds.listedTooLongDays) {
        items.push({
          id: `listed:${bike.id}`,
          kind: 'LISTED_TOO_LONG',
          severity: 'warning',
          motorcycleId: bike.id,
          title: `${name} — sudah ${listedDays} hari diiklankan`,
          detail: 'Pertimbangkan menurunkan harga atau memperbarui foto iklan.',
        })
      }
    }
  }

  // 6. Documents approaching expiry
  for (const doc of documents) {
    const daysLeft = differenceInCalendarDays(asOf, doc.expiresAt)
    if (daysLeft <= thresholds.documentExpiryNoticeDays) {
      items.push({
        id: `doc:${doc.id}`,
        kind: 'DOCUMENT_EXPIRING',
        severity: daysLeft < 0 ? 'danger' : 'warning',
        motorcycleId: doc.motorcycleId,
        title:
          daysLeft < 0
            ? `${doc.label} sudah kedaluwarsa`
            : `${doc.label} kedaluwarsa dalam ${daysLeft} hari`,
        detail: 'Perpanjang sebelum motor dijual.',
      })
    }
  }

  const severityRank: Record<AttentionSeverity, number> = {
    danger: 0,
    warning: 1,
    info: 2,
  }
  return items.sort(
    (a, b) => severityRank[a.severity] - severityRank[b.severity],
  )
}

export type { BasisPoints }
