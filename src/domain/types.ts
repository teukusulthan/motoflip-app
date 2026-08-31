/**
 * Domain types.
 *
 * Deliberately independent of Prisma: the domain layer must be testable with
 * plain object literals and no database. `src/data` maps Prisma rows onto
 * these shapes at the boundary.
 */
import type { Rupiah } from './money'

export type LedgerEntryType = 'INCOME' | 'EXPENSE' | 'TRANSFER'

export type CategoryKind = 'INCOME' | 'EXPENSE'

export type CategoryGroup =
  | 'ACQUISITION'
  | 'REPAIR'
  | 'MAINTENANCE'
  | 'DOCUMENTATION'
  | 'LOGISTICS'
  | 'SELLING'
  | 'OTHER'
  | 'SALE'
  | 'OTHER_INCOME'

export type CategoryRole = 'NORMAL' | 'PURCHASE' | 'SALE'

export type MotorcycleStatus =
  | 'LEAD'
  | 'PURCHASING'
  | 'OWNED'
  | 'PREPARATION'
  | 'READY_TO_SELL'
  | 'LISTED'
  | 'NEGOTIATION'
  | 'SOLD'
  | 'ARCHIVED'

export type AcquisitionSource =
  | 'FACEBOOK_MARKETPLACE'
  | 'OLX'
  | 'DEALER'
  | 'DIRECT_OWNER'
  | 'FRIEND'
  | 'WORKSHOP'
  | 'AUCTION'
  | 'INSTAGRAM'
  | 'OTHER'

/** The minimum a ledger entry must expose for the financial engine to work. */
export interface DomainLedgerEntry {
  id: string
  type: LedgerEntryType
  amount: Rupiah
  occurredAt: Date
  accountId: string
  toAccountId: string | null
  motorcycleId: string | null
  categoryId: string
  categoryGroup: CategoryGroup
  categoryRole: CategoryRole
  vendorId: string | null
  voidedAt: Date | null
}

/** The minimum a motorcycle must expose for the financial engine to work. */
export interface DomainMotorcycle {
  id: string
  brand: string
  model: string
  variant: string | null
  year: number
  status: MotorcycleStatus
  acquisitionSource: AcquisitionSource
  projectedPurchasePrice: Rupiah | null
  projectedRepairCost: Rupiah | null
  targetSellingPrice: Rupiah | null
  listedAt: Date | null
  createdAt: Date
  archivedAt: Date | null
}

/** Statuses in which capital is still locked up in the bike. */
export const IN_INVENTORY_STATUSES: readonly MotorcycleStatus[] = [
  'OWNED',
  'PREPARATION',
  'READY_TO_SELL',
  'LISTED',
  'NEGOTIATION',
]

/** Statuses that represent a completed flip. */
export const CLOSED_STATUSES: readonly MotorcycleStatus[] = ['SOLD', 'ARCHIVED']

export const isInInventory = (status: MotorcycleStatus): boolean =>
  IN_INVENTORY_STATUSES.includes(status)

export const isClosed = (status: MotorcycleStatus): boolean =>
  CLOSED_STATUSES.includes(status)
