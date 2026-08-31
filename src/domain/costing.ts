/**
 * Per-motorcycle financial engine — §8, §9.
 *
 * Every figure here is derived from ledger entries. Nothing is cached, nothing
 * is stored, and no function reads a "total" field off a motorcycle row: there
 * is exactly one writable copy of every rupiah figure, so no two numbers in the
 * application can disagree.
 */
import { differenceInCalendarDays } from './dates'
import {
  type BasisPoints,
  type Rupiah,
  ZERO,
  addRupiah,
  ratioToBps,
  subRupiah,
  sumRupiah,
} from './money'
import type { CategoryGroup, DomainLedgerEntry, DomainMotorcycle } from './types'

/** Voided entries never participate in any calculation — §38. */
export function activeEntries(
  entries: readonly DomainLedgerEntry[],
): DomainLedgerEntry[] {
  return entries.filter((entry) => entry.voidedAt === null)
}

const isExpense = (e: DomainLedgerEntry) => e.type === 'EXPENSE'
const isIncome = (e: DomainLedgerEntry) => e.type === 'INCOME'

/**
 * Total actual cost — §8.
 *
 * Sums every non-voided EXPENSE attributed to the motorcycle, which by
 * construction includes the purchase itself plus acquisition, repair,
 * maintenance, documentation, logistics, selling and other costs.
 *
 * TRANSFER entries are structurally excluded because they are not of type
 * EXPENSE — §15's rule that moving money between your own accounts is not a
 * cost is enforced by the type system rather than by remembering to filter.
 */
export function totalCost(entries: readonly DomainLedgerEntry[]): Rupiah {
  return sumRupiah(activeEntries(entries).filter(isExpense).map((e) => e.amount))
}

/** Gross revenue attributed to the motorcycle (normally a single sale). */
export function grossRevenue(entries: readonly DomainLedgerEntry[]): Rupiah {
  return sumRupiah(activeEntries(entries).filter(isIncome).map((e) => e.amount))
}

/** The acquisition entry, if the bike has been bought. */
export function purchaseEntry(
  entries: readonly DomainLedgerEntry[],
): DomainLedgerEntry | null {
  return (
    activeEntries(entries).find((e) => e.categoryRole === 'PURCHASE') ?? null
  )
}

/** The disposal entry, if the bike has been sold. */
export function saleEntry(
  entries: readonly DomainLedgerEntry[],
): DomainLedgerEntry | null {
  return activeEntries(entries).find((e) => e.categoryRole === 'SALE') ?? null
}

export function purchasePrice(
  entries: readonly DomainLedgerEntry[],
): Rupiah | null {
  return purchaseEntry(entries)?.amount ?? null
}

export function purchaseDate(entries: readonly DomainLedgerEntry[]): Date | null {
  return purchaseEntry(entries)?.occurredAt ?? null
}

export function salePrice(entries: readonly DomainLedgerEntry[]): Rupiah | null {
  return saleEntry(entries)?.amount ?? null
}

export function saleDate(entries: readonly DomainLedgerEntry[]): Date | null {
  return saleEntry(entries)?.occurredAt ?? null
}

/** Costs incurred after the purchase — what §7 shows as "Expenses". */
export function additionalCosts(entries: readonly DomainLedgerEntry[]): Rupiah {
  return sumRupiah(
    activeEntries(entries)
      .filter(isExpense)
      .filter((e) => e.categoryRole !== 'PURCHASE')
      .map((e) => e.amount),
  )
}

export type CostBreakdown = Record<CategoryGroup, Rupiah>

const EMPTY_BREAKDOWN = (): CostBreakdown => ({
  ACQUISITION: ZERO,
  REPAIR: ZERO,
  MAINTENANCE: ZERO,
  DOCUMENTATION: ZERO,
  LOGISTICS: ZERO,
  SELLING: ZERO,
  OTHER: ZERO,
  SALE: ZERO,
  OTHER_INCOME: ZERO,
})

/** Expense total per category group — feeds §17's "expenses by category". */
export function costBreakdown(
  entries: readonly DomainLedgerEntry[],
): CostBreakdown {
  const breakdown = EMPTY_BREAKDOWN()
  for (const entry of activeEntries(entries)) {
    if (!isExpense(entry)) continue
    breakdown[entry.categoryGroup] = addRupiah(
      breakdown[entry.categoryGroup],
      entry.amount,
    )
  }
  return breakdown
}

/**
 * Net profit — §8.
 *
 * Never "selling price − purchase price". Revenue minus EVERY cost.
 */
export function netProfit(entries: readonly DomainLedgerEntry[]): Rupiah {
  return subRupiah(grossRevenue(entries), totalCost(entries))
}

/** ROI in basis points, or null when nothing has been invested yet. */
export function roi(entries: readonly DomainLedgerEntry[]): BasisPoints | null {
  return ratioToBps(netProfit(entries), totalCost(entries))
}

/**
 * Holding period in calendar days.
 *
 * Bought but unsold → days held so far, measured against `asOf`.
 * Not yet bought → null.
 */
export function holdingPeriodDays(
  entries: readonly DomainLedgerEntry[],
  asOf: Date = new Date(),
): number | null {
  const bought = purchaseDate(entries)
  if (bought === null) return null

  const sold = saleDate(entries)
  const end = sold ?? asOf
  return Math.max(0, differenceInCalendarDays(bought, end))
}

/**
 * Profit per day — §8.
 *
 * A same-day flip has a zero-day holding period. Dividing by zero is
 * undefined, but the business meaning is not: the whole profit was earned in
 * one day. The denominator is therefore floored at 1.
 */
export function profitPerDay(
  entries: readonly DomainLedgerEntry[],
  asOf: Date = new Date(),
): Rupiah | null {
  const days = holdingPeriodDays(entries, asOf)
  if (days === null) return null

  const profit = netProfit(entries)
  const divisor = BigInt(Math.max(1, days))
  return (profit / divisor) as Rupiah
}

/** Everything §7's detail header needs, computed once. */
export interface MotorcycleFinancials {
  purchasePrice: Rupiah | null
  purchaseDate: Date | null
  additionalCosts: Rupiah
  totalCost: Rupiah
  breakdown: CostBreakdown
  salePrice: Rupiah | null
  saleDate: Date | null
  grossRevenue: Rupiah
  netProfit: Rupiah
  roi: BasisPoints | null
  holdingPeriodDays: number | null
  profitPerDay: Rupiah | null
  isSold: boolean
}

export function motorcycleFinancials(
  entries: readonly DomainLedgerEntry[],
  asOf: Date = new Date(),
): MotorcycleFinancials {
  const active = activeEntries(entries)
  const sold = saleEntry(active) !== null

  return {
    purchasePrice: purchasePrice(active),
    purchaseDate: purchaseDate(active),
    additionalCosts: additionalCosts(active),
    totalCost: totalCost(active),
    breakdown: costBreakdown(active),
    salePrice: salePrice(active),
    saleDate: saleDate(active),
    grossRevenue: grossRevenue(active),
    netProfit: netProfit(active),
    roi: roi(active),
    holdingPeriodDays: holdingPeriodDays(active, asOf),
    profitPerDay: profitPerDay(active, asOf),
    isSold: sold,
  }
}

// ------------------------------------------------------------ projections --

/**
 * Expected economics for a bike still in inventory — the "Expected Profit" and
 * "Expected ROI" of §7.
 *
 * Uses the actual cost incurred so far, plus whatever remains of the repair
 * budget, against the target selling price. Returns null where the user has
 * not set a target, rather than inventing one.
 */
export interface ExpectedOutcome {
  expectedTotalCost: Rupiah
  expectedProfit: Rupiah
  expectedRoi: BasisPoints | null
}

export function expectedOutcome(
  motorcycle: Pick<
    DomainMotorcycle,
    'projectedRepairCost' | 'targetSellingPrice'
  >,
  entries: readonly DomainLedgerEntry[],
): ExpectedOutcome | null {
  const target = motorcycle.targetSellingPrice
  if (target === null) return null

  const spent = totalCost(entries)
  const repairBudget = motorcycle.projectedRepairCost ?? ZERO
  const spentOnRepair = costBreakdown(entries).REPAIR

  // Only the unspent remainder of the repair budget is still to come.
  const remainingRepair =
    repairBudget > spentOnRepair
      ? ((repairBudget - spentOnRepair) as Rupiah)
      : ZERO

  const expectedTotalCost = addRupiah(spent, remainingRepair)
  const expectedProfit = subRupiah(target, expectedTotalCost)

  return {
    expectedTotalCost,
    expectedProfit,
    expectedRoi: ratioToBps(expectedProfit, expectedTotalCost),
  }
}
