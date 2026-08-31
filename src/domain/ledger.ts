/**
 * Business-level financial engine — §15, §16.
 *
 * Cash, Capital and Realized Profit are three different questions and are
 * answered by three different functions here. In particular, buying a
 * motorcycle moves money from Cash into Capital; it is never a loss.
 */
import { isWithin } from './dates'
import {
  type BasisPoints,
  type Rupiah,
  ZERO,
  addRupiah,
  ratioToBps,
  subRupiah,
  sumRupiah,
} from './money'
import { totalCost, netProfit } from './costing'
import {
  type DomainLedgerEntry,
  type DomainMotorcycle,
  isClosed,
  isInInventory,
} from './types'

export interface DomainCashAccount {
  id: string
  name: string
  kind: 'CASH' | 'BANK' | 'EWALLET'
  openingBalance: Rupiah
  archivedAt: Date | null
}

const active = (entries: readonly DomainLedgerEntry[]) =>
  entries.filter((e) => e.voidedAt === null)

/**
 * Balance of one cash account.
 *
 * `accountId` is the source for EXPENSE and TRANSFER, and the destination for
 * INCOME. `toAccountId` is the destination of a TRANSFER.
 */
export function cashAccountBalance(
  account: DomainCashAccount,
  entries: readonly DomainLedgerEntry[],
): Rupiah {
  let balance = account.openingBalance as bigint

  for (const entry of active(entries)) {
    if (entry.type === 'INCOME' && entry.accountId === account.id) {
      balance += entry.amount
    } else if (entry.type === 'EXPENSE' && entry.accountId === account.id) {
      balance -= entry.amount
    } else if (entry.type === 'TRANSFER') {
      if (entry.accountId === account.id) balance -= entry.amount
      if (entry.toAccountId === account.id) balance += entry.amount
    }
  }

  return balance as Rupiah
}

/**
 * Total available cash — §16.
 *
 * Transfers cancel out across accounts by construction, so this never
 * double-counts money moved between your own wallets.
 */
export function availableCash(
  accounts: readonly DomainCashAccount[],
  entries: readonly DomainLedgerEntry[],
): Rupiah {
  return sumRupiah(
    accounts.map((account) => cashAccountBalance(account, entries)),
  )
}

/** Entries belonging to one motorcycle. */
export function entriesFor(
  motorcycleId: string,
  entries: readonly DomainLedgerEntry[],
): DomainLedgerEntry[] {
  return entries.filter((e) => e.motorcycleId === motorcycleId)
}

/**
 * Capital locked in unsold inventory — §16.
 *
 * This is money you still own, held in the form of motorcycles rather than
 * cash. It is deliberately measured at cost, not at hoped-for resale value.
 */
export function inventoryCapital(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): Rupiah {
  return sumRupiah(
    motorcycles
      .filter((m) => isInInventory(m.status))
      .map((m) => totalCost(entriesFor(m.id, entries))),
  )
}

/** Estimated resale value of current inventory, from user targets only. */
export function inventoryEstimatedValue(
  motorcycles: readonly DomainMotorcycle[],
): Rupiah {
  return sumRupiah(
    motorcycles
      .filter((m) => isInInventory(m.status))
      .map((m) => m.targetSellingPrice ?? ZERO),
  )
}

/** Profit from completed flips only — §16. */
export function realizedProfit(
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): Rupiah {
  return sumRupiah(
    motorcycles
      .filter((m) => isClosed(m.status))
      .map((m) => netProfit(entriesFor(m.id, entries))),
  )
}

/**
 * Business expenses not attributable to any motorcycle (§15) — these DO reduce
 * profit but belong to no single flip.
 */
export function businessExpenses(
  entries: readonly DomainLedgerEntry[],
): Rupiah {
  return sumRupiah(
    active(entries)
      .filter((e) => e.type === 'EXPENSE' && e.motorcycleId === null)
      .map((e) => e.amount),
  )
}

export interface BusinessSummary {
  availableCash: Rupiah
  inventoryCapital: Rupiah
  inventoryEstimatedValue: Rupiah
  totalAssets: Rupiah
  unrealizedProfit: Rupiah
  realizedProfit: Rupiah
  businessExpenses: Rupiah
  netRealizedProfit: Rupiah
  averageRoi: BasisPoints | null
}

/** Everything the §4 financial summary needs, computed in one pass. */
export function businessSummary(
  accounts: readonly DomainCashAccount[],
  motorcycles: readonly DomainMotorcycle[],
  entries: readonly DomainLedgerEntry[],
): BusinessSummary {
  const cash = availableCash(accounts, entries)
  const capital = inventoryCapital(motorcycles, entries)
  const estimated = inventoryEstimatedValue(motorcycles)
  const realized = realizedProfit(motorcycles, entries)
  const business = businessExpenses(entries)

  const sold = motorcycles.filter((m) => isClosed(m.status))
  const soldCost = sumRupiah(sold.map((m) => totalCost(entriesFor(m.id, entries))))

  return {
    availableCash: cash,
    inventoryCapital: capital,
    inventoryEstimatedValue: estimated,
    totalAssets: addRupiah(cash, capital),
    unrealizedProfit: subRupiah(estimated, capital),
    realizedProfit: realized,
    businessExpenses: business,
    netRealizedProfit: subRupiah(realized, business),
    averageRoi: ratioToBps(realized, soldCost),
  }
}

// ------------------------------------------------------------ period views --

export interface PeriodTotals {
  revenue: Rupiah
  expenses: Rupiah
  net: Rupiah
}

/** Revenue and expenses within a date range — §4's current-month figures. */
export function periodTotals(
  entries: readonly DomainLedgerEntry[],
  from: Date,
  to: Date,
): PeriodTotals {
  const inPeriod = active(entries).filter((e) =>
    isWithin(e.occurredAt, from, to),
  )

  const revenue = sumRupiah(
    inPeriod.filter((e) => e.type === 'INCOME').map((e) => e.amount),
  )
  const expenses = sumRupiah(
    inPeriod.filter((e) => e.type === 'EXPENSE').map((e) => e.amount),
  )

  return { revenue, expenses, net: subRupiah(revenue, expenses) }
}
