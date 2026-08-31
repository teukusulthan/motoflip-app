/** Test builders — keep the domain tests readable and database-free. */
import { type Rupiah, rupiah } from '../money'
import type {
  CategoryGroup,
  CategoryRole,
  DomainLedgerEntry,
  DomainMotorcycle,
  LedgerEntryType,
  MotorcycleStatus,
} from '../types'
import type { DomainCashAccount } from '../ledger'

let counter = 0
const nextId = (prefix: string) => `${prefix}-${(counter += 1)}`

export const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`)

export function entry(
  overrides: Partial<DomainLedgerEntry> & {
    amount: Rupiah | number
    type?: LedgerEntryType
  },
): DomainLedgerEntry {
  const { amount, ...rest } = overrides
  return {
    id: nextId('entry'),
    type: 'EXPENSE',
    amount: typeof amount === 'number' ? rupiah(amount) : amount,
    occurredAt: d('2026-08-01'),
    accountId: 'acc-main',
    toAccountId: null,
    motorcycleId: 'bike-1',
    categoryId: 'cat-1',
    categoryGroup: 'REPAIR' as CategoryGroup,
    categoryRole: 'NORMAL' as CategoryRole,
    vendorId: null,
    voidedAt: null,
    ...rest,
  }
}

export const purchase = (amount: number, on: string, motorcycleId = 'bike-1') =>
  entry({
    amount,
    type: 'EXPENSE',
    categoryGroup: 'ACQUISITION',
    categoryRole: 'PURCHASE',
    occurredAt: d(on),
    motorcycleId,
  })

export const sale = (amount: number, on: string, motorcycleId = 'bike-1') =>
  entry({
    amount,
    type: 'INCOME',
    categoryGroup: 'SALE',
    categoryRole: 'SALE',
    occurredAt: d(on),
    motorcycleId,
  })

export const cost = (
  amount: number,
  group: CategoryGroup,
  on = '2026-08-05',
  motorcycleId = 'bike-1',
) =>
  entry({
    amount,
    type: 'EXPENSE',
    categoryGroup: group,
    occurredAt: d(on),
    motorcycleId,
  })

export const transfer = (
  amount: number,
  from: string,
  to: string,
  on = '2026-08-05',
) =>
  entry({
    amount,
    type: 'TRANSFER',
    accountId: from,
    toAccountId: to,
    motorcycleId: null,
    categoryGroup: 'OTHER',
    occurredAt: d(on),
  })

export function motorcycle(
  overrides: Partial<DomainMotorcycle> = {},
): DomainMotorcycle {
  return {
    id: 'bike-1',
    brand: 'Yamaha',
    model: 'NMAX',
    variant: null,
    year: 2022,
    status: 'OWNED' as MotorcycleStatus,
    acquisitionSource: 'OLX',
    projectedPurchasePrice: null,
    projectedRepairCost: null,
    targetSellingPrice: null,
    listedAt: null,
    createdAt: d('2026-08-01'),
    archivedAt: null,
    ...overrides,
  }
}

export function account(
  overrides: Partial<DomainCashAccount> = {},
): DomainCashAccount {
  return {
    id: 'acc-main',
    name: 'Kas Utama',
    kind: 'CASH',
    openingBalance: rupiah(0),
    archivedAt: null,
    ...overrides,
  }
}
