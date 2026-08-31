/**
 * Projected vs actual — §9.
 *
 * The point of this module is to let the user grade their own estimates. It
 * compares what they expected before the flip against what the ledger actually
 * recorded, and says which direction the difference runs.
 */
import {
  type BasisPoints,
  type Rupiah,
  ZERO,
  addRupiah,
  ratioToBps,
  subRupiah,
} from './money'
import { motorcycleFinancials } from './costing'
import type { DomainLedgerEntry, DomainMotorcycle } from './types'

export interface ProjectedOutcome {
  projectedPurchase: Rupiah | null
  projectedRepair: Rupiah | null
  projectedCost: Rupiah | null
  projectedSale: Rupiah | null
  projectedProfit: Rupiah | null
  projectedRoi: BasisPoints | null
}

/** The estimate the user recorded before buying. */
export function projectedOutcome(
  motorcycle: Pick<
    DomainMotorcycle,
    'projectedPurchasePrice' | 'projectedRepairCost' | 'targetSellingPrice'
  >,
): ProjectedOutcome {
  const purchase = motorcycle.projectedPurchasePrice
  const repair = motorcycle.projectedRepairCost
  const sale = motorcycle.targetSellingPrice

  const cost =
    purchase === null ? null : addRupiah(purchase, repair ?? ZERO)

  const profit = cost === null || sale === null ? null : subRupiah(sale, cost)

  return {
    projectedPurchase: purchase,
    projectedRepair: repair,
    projectedCost: cost,
    projectedSale: sale,
    projectedProfit: profit,
    projectedRoi: profit === null || cost === null ? null : ratioToBps(profit, cost),
  }
}

/** Which way a difference runs, for colour and copy in the UI. */
export type VarianceDirection = 'better' | 'worse' | 'on-target' | 'unknown'

export interface VarianceLine {
  projected: Rupiah | null
  actual: Rupiah | null
  delta: Rupiah | null
  direction: VarianceDirection
}

/**
 * @param higherIsBetter true for revenue and profit, false for costs.
 */
function compare(
  projected: Rupiah | null,
  actual: Rupiah | null,
  higherIsBetter: boolean,
): VarianceLine {
  if (projected === null || actual === null) {
    return { projected, actual, delta: null, direction: 'unknown' }
  }

  const delta = subRupiah(actual, projected)

  let direction: VarianceDirection
  if (delta === ZERO) {
    direction = 'on-target'
  } else if (delta > ZERO) {
    direction = higherIsBetter ? 'better' : 'worse'
  } else {
    direction = higherIsBetter ? 'worse' : 'better'
  }

  return { projected, actual, delta, direction }
}

export interface VarianceReport {
  purchase: VarianceLine
  cost: VarianceLine
  sale: VarianceLine
  profit: VarianceLine
  projectedRoi: BasisPoints | null
  actualRoi: BasisPoints | null
  roiDeltaBps: number | null
}

export function varianceReport(
  motorcycle: Pick<
    DomainMotorcycle,
    'projectedPurchasePrice' | 'projectedRepairCost' | 'targetSellingPrice'
  >,
  entries: readonly DomainLedgerEntry[],
  asOf: Date = new Date(),
): VarianceReport {
  const projected = projectedOutcome(motorcycle)
  const actual = motorcycleFinancials(entries, asOf)

  return {
    purchase: compare(projected.projectedPurchase, actual.purchasePrice, false),
    cost: compare(projected.projectedCost, actual.totalCost, false),
    sale: compare(projected.projectedSale, actual.salePrice, true),
    profit: compare(
      projected.projectedProfit,
      actual.isSold ? actual.netProfit : null,
      true,
    ),
    projectedRoi: projected.projectedRoi,
    actualRoi: actual.isSold ? actual.roi : null,
    roiDeltaBps:
      projected.projectedRoi !== null && actual.isSold && actual.roi !== null
        ? actual.roi - projected.projectedRoi
        : null,
  }
}
