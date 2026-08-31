import 'server-only'
import type {
  CashAccount as PrismaCashAccount,
  Category as PrismaCategory,
  LedgerEntry as PrismaLedgerEntry,
  Motorcycle as PrismaMotorcycle,
} from '@prisma/client'
import { type Rupiah, rupiah } from '@/domain/money'
import type { DomainLedgerEntry, DomainMotorcycle } from '@/domain/types'
import type { DomainCashAccount } from '@/domain/ledger'

const money = (value: bigint): Rupiah => rupiah(value)
const optionalMoney = (value: bigint | null): Rupiah | null =>
  value === null ? null : rupiah(value)

export type LedgerEntryWithCategory = PrismaLedgerEntry & {
  category: Pick<PrismaCategory, 'group' | 'role'>
}

/**
 * A domain entry plus the fields the UI needs to label it.
 *
 * Structurally still a DomainLedgerEntry, so every domain function accepts it
 * unchanged while the views get the note and category name they must render.
 */
export type LedgerEntryView = DomainLedgerEntry & {
  note: string | null
  receiptUrl: string | null
}

/**
 * Prisma row → domain value.
 *
 * The domain layer must never see a Prisma type; this boundary is the only
 * place the two vocabularies meet.
 */
export function toDomainEntry(row: LedgerEntryWithCategory): LedgerEntryView {
  return {
    id: row.id,
    type: row.type,
    amount: money(row.amount),
    occurredAt: row.occurredAt,
    accountId: row.accountId,
    toAccountId: row.toAccountId,
    motorcycleId: row.motorcycleId,
    categoryId: row.categoryId,
    categoryGroup: row.category.group,
    categoryRole: row.category.role,
    vendorId: row.vendorId,
    voidedAt: row.voidedAt,
    note: row.note,
    receiptUrl: row.receiptUrl,
  }
}

export function toDomainMotorcycle(row: PrismaMotorcycle): DomainMotorcycle {
  return {
    id: row.id,
    brand: row.brand,
    model: row.model,
    variant: row.variant,
    year: row.year,
    status: row.status,
    acquisitionSource: row.acquisitionSource,
    projectedPurchasePrice: optionalMoney(row.projectedPurchasePrice),
    projectedRepairCost: optionalMoney(row.projectedRepairCost),
    targetSellingPrice: optionalMoney(row.targetSellingPrice),
    listedAt: row.listedAt,
    createdAt: row.createdAt,
    archivedAt: row.archivedAt,
  }
}

export function toDomainAccount(row: PrismaCashAccount): DomainCashAccount {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    openingBalance: money(row.openingBalance),
    archivedAt: row.archivedAt,
  }
}

/** The include clause every ledger query needs for the domain mapper to work. */
export const LEDGER_INCLUDE = {
  category: { select: { group: true, role: true } },
} as const
