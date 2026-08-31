import { describe, expect, it } from 'vitest'
import {
  account,
  cost,
  d,
  motorcycle,
  purchase,
  sale,
  transfer,
} from './__fixtures__/builders'
import {
  availableCash,
  businessExpenses,
  businessSummary,
  cashAccountBalance,
  inventoryCapital,
  periodTotals,
  realizedProfit,
} from './ledger'
import { entry } from './__fixtures__/builders'
import { rupiah } from './money'

const main = account({ id: 'acc-main', openingBalance: rupiah(50_000_000) })
const bank = account({ id: 'acc-bank', name: 'Bank', kind: 'BANK' })

describe('cashAccountBalance()', () => {
  it('starts from the opening balance', () => {
    expect(cashAccountBalance(main, [])).toBe(50_000_000n)
  })

  it('subtracts expenses paid from the account', () => {
    const entries = [purchase(21_500_000, '2026-08-04')]
    expect(cashAccountBalance(main, entries)).toBe(28_500_000n)
  })

  it('adds income received into the account', () => {
    const entries = [sale(26_000_000, '2026-08-27')]
    expect(cashAccountBalance(main, entries)).toBe(76_000_000n)
  })

  it('ignores entries belonging to other accounts', () => {
    const entries = [entry({ amount: 1_000_000, accountId: 'acc-bank' })]
    expect(cashAccountBalance(main, entries)).toBe(50_000_000n)
  })

  it('ignores voided entries', () => {
    const entries = [
      entry({ amount: 1_000_000, voidedAt: d('2026-08-10') }),
    ]
    expect(cashAccountBalance(main, entries)).toBe(50_000_000n)
  })
})

describe('transfers (§15)', () => {
  const entries = [transfer(10_000_000, 'acc-main', 'acc-bank', '2026-08-10')]

  it('debits the source account', () => {
    expect(cashAccountBalance(main, entries)).toBe(40_000_000n)
  })

  it('credits the destination account', () => {
    expect(cashAccountBalance(bank, entries)).toBe(10_000_000n)
  })

  it('leaves total cash unchanged', () => {
    expect(availableCash([main, bank], entries)).toBe(50_000_000n)
    expect(availableCash([main, bank], [])).toBe(50_000_000n)
  })

  it('never counts as a business expense', () => {
    expect(businessExpenses(entries)).toBe(0n)
  })
})

describe('cash vs capital vs profit (§16)', () => {
  const bikes = [
    motorcycle({ id: 'bike-1', status: 'OWNED', targetSellingPrice: rupiah(27_000_000) }),
    motorcycle({ id: 'bike-2', status: 'SOLD' }),
  ]

  const entries = [
    purchase(21_500_000, '2026-08-04', 'bike-1'),
    cost(450_000, 'REPAIR', '2026-08-05', 'bike-1'),
    purchase(18_000_000, '2026-07-01', 'bike-2'),
    cost(1_000_000, 'REPAIR', '2026-07-05', 'bike-2'),
    sale(22_000_000, '2026-07-25', 'bike-2'),
  ]

  it('does not treat an inventory purchase as a loss', () => {
    const summary = businessSummary([main], bikes, entries)
    // Only the completed flip contributes to realized profit.
    expect(summary.realizedProfit).toBe(3_000_000n)
  })

  it('locks the unsold bike cost into capital, not profit', () => {
    expect(inventoryCapital(bikes, entries)).toBe(21_950_000n)
  })

  it('counts realized profit from completed flips only', () => {
    expect(realizedProfit(bikes, entries)).toBe(3_000_000n)
  })

  it('reports total assets as cash plus capital', () => {
    const summary = businessSummary([main], bikes, entries)
    expect(summary.totalAssets).toBe(
      summary.availableCash + summary.inventoryCapital,
    )
  })

  it('derives unrealized profit from targets minus capital', () => {
    const summary = businessSummary([main], bikes, entries)
    // Target 27,000,000 against 21,950,000 of capital.
    expect(summary.unrealizedProfit).toBe(5_050_000n)
  })

  it('computes average ROI over sold stock only', () => {
    const summary = businessSummary([main], bikes, entries)
    // 3,000,000 / 19,000,000 = 15.78%
    expect(summary.averageRoi).toBe(1579)
  })
})

describe('businessExpenses()', () => {
  it('counts only entries not attributed to a motorcycle', () => {
    const entries = [
      purchase(20_000_000, '2026-08-01', 'bike-1'),
      entry({ amount: 500_000, motorcycleId: null, categoryGroup: 'OTHER' }),
    ]
    expect(businessExpenses(entries)).toBe(500_000n)
  })
})

describe('periodTotals()', () => {
  const entries = [
    sale(26_000_000, '2026-08-27'),
    cost(450_000, 'REPAIR', '2026-08-05'),
    cost(999_000, 'REPAIR', '2026-07-05'),
  ]

  it('includes only entries inside the range', () => {
    const totals = periodTotals(entries, d('2026-08-01'), d('2026-08-31'))
    expect(totals.revenue).toBe(26_000_000n)
    expect(totals.expenses).toBe(450_000n)
    expect(totals.net).toBe(25_550_000n)
  })

  it('is inclusive of both boundary dates', () => {
    const totals = periodTotals(entries, d('2026-08-27'), d('2026-08-27'))
    expect(totals.revenue).toBe(26_000_000n)
  })
})
