import { describe, expect, it } from 'vitest'
import { cost, d, entry, motorcycle, purchase, sale } from './__fixtures__/builders'
import {
  additionalCosts,
  costBreakdown,
  expectedOutcome,
  grossRevenue,
  holdingPeriodDays,
  motorcycleFinancials,
  netProfit,
  profitPerDay,
  roi,
  totalCost,
} from './costing'
import { rupiah } from './money'

describe('the worked example from the specification (§8)', () => {
  const entries = [
    purchase(21_500_000, '2026-08-04'),
    cost(450_000, 'REPAIR', '2026-08-05'),
    cost(120_000, 'MAINTENANCE', '2026-08-05'),
    cost(300_000, 'MAINTENANCE', '2026-08-06'),
    cost(150_000, 'LOGISTICS', '2026-08-06'),
    cost(200_000, 'DOCUMENTATION', '2026-08-07'),
    sale(26_000_000, '2026-08-27'),
  ]

  it('totals cost to exactly 22,720,000', () => {
    expect(totalCost(entries)).toBe(22_720_000n)
  })

  it('nets profit to exactly 3,280,000', () => {
    expect(netProfit(entries)).toBe(3_280_000n)
  })

  it('never computes profit as sale minus purchase alone', () => {
    const naive = 26_000_000n - 21_500_000n
    expect(netProfit(entries)).not.toBe(naive)
    expect(netProfit(entries)).toBeLessThan(naive)
  })

  it('reports ROI against total cost, not purchase price', () => {
    expect(roi(entries)).toBe(1444) // 14.44%
  })

  it('measures the holding period from purchase to sale', () => {
    expect(holdingPeriodDays(entries)).toBe(23)
  })

  it('divides profit across the holding period', () => {
    expect(profitPerDay(entries)).toBe(142_608n)
  })
})

describe('totalCost()', () => {
  it('is zero for a motorcycle with no entries', () => {
    expect(totalCost([])).toBe(0n)
  })

  it('counts the purchase alone when nothing else is spent', () => {
    expect(totalCost([purchase(21_500_000, '2026-08-04')])).toBe(21_500_000n)
  })

  it('accumulates many expenses of the same category', () => {
    const entries = [
      purchase(20_000_000, '2026-08-01'),
      cost(100_000, 'REPAIR'),
      cost(250_000, 'REPAIR'),
      cost(75_000, 'REPAIR'),
    ]
    expect(totalCost(entries)).toBe(20_425_000n)
  })

  it('excludes income', () => {
    const entries = [purchase(20_000_000, '2026-08-01'), sale(25_000_000, '2026-08-20')]
    expect(totalCost(entries)).toBe(20_000_000n)
  })

  it('excludes voided entries (§38)', () => {
    const entries = [
      purchase(21_500_000, '2026-08-04'),
      entry({ amount: 450_000, voidedAt: d('2026-08-06') }),
    ]
    expect(totalCost(entries)).toBe(21_500_000n)
  })
})

describe('additionalCosts()', () => {
  it('separates post-purchase spend from the acquisition itself', () => {
    const entries = [
      purchase(22_000_000, '2026-08-01'),
      cost(1_200_000, 'REPAIR'),
      cost(500_000, 'DOCUMENTATION'),
    ]
    expect(additionalCosts(entries)).toBe(1_700_000n)
  })
})

describe('costBreakdown()', () => {
  it('groups spend by category group', () => {
    const breakdown = costBreakdown([
      purchase(20_000_000, '2026-08-01'),
      cost(450_000, 'REPAIR'),
      cost(150_000, 'REPAIR'),
      cost(200_000, 'DOCUMENTATION'),
    ])
    expect(breakdown.ACQUISITION).toBe(20_000_000n)
    expect(breakdown.REPAIR).toBe(600_000n)
    expect(breakdown.DOCUMENTATION).toBe(200_000n)
    expect(breakdown.LOGISTICS).toBe(0n)
  })
})

describe('netProfit() edge cases (§37)', () => {
  it('is negative when the bike sells below total cost', () => {
    const entries = [
      purchase(22_000_000, '2026-08-01'),
      cost(2_000_000, 'REPAIR'),
      sale(23_000_000, '2026-08-20'),
    ]
    expect(netProfit(entries)).toBe(-1_000_000n)
    expect(roi(entries)).toBe(-417)
  })

  it('is exactly zero on a break-even sale', () => {
    const entries = [
      purchase(20_000_000, '2026-08-01'),
      cost(1_000_000, 'REPAIR'),
      sale(21_000_000, '2026-08-20'),
    ]
    expect(netProfit(entries)).toBe(0n)
    expect(roi(entries)).toBe(0)
  })

  it('is the negative of cost while the bike is still unsold', () => {
    const entries = [purchase(20_000_000, '2026-08-01')]
    expect(grossRevenue(entries)).toBe(0n)
    expect(netProfit(entries)).toBe(-20_000_000n)
  })
})

describe('roi()', () => {
  it('is null when nothing has been spent, rather than Infinity', () => {
    expect(roi([])).toBeNull()
    expect(roi([sale(1_000_000, '2026-08-01')])).toBeNull()
  })
})

describe('holdingPeriodDays()', () => {
  it('is null before the bike is bought', () => {
    expect(holdingPeriodDays([])).toBeNull()
  })

  it('counts days elapsed so far while the bike is unsold', () => {
    const entries = [purchase(20_000_000, '2026-08-01')]
    expect(holdingPeriodDays(entries, d('2026-08-15'))).toBe(14)
  })

  it('is zero for a same-day flip', () => {
    const entries = [
      purchase(20_000_000, '2026-08-01'),
      sale(22_000_000, '2026-08-01'),
    ]
    expect(holdingPeriodDays(entries)).toBe(0)
  })
})

describe('profitPerDay()', () => {
  it('treats a same-day flip as one day rather than dividing by zero', () => {
    const entries = [
      purchase(20_000_000, '2026-08-01'),
      sale(22_000_000, '2026-08-01'),
    ]
    expect(holdingPeriodDays(entries)).toBe(0)
    expect(profitPerDay(entries)).toBe(2_000_000n)
  })

  it('is null before the bike is bought', () => {
    expect(profitPerDay([])).toBeNull()
  })
})

describe('expectedOutcome() — the §7 detail header', () => {
  const bike = motorcycle({
    projectedRepairCost: rupiah(2_000_000),
    targetSellingPrice: rupiah(27_000_000),
  })

  it('reproduces the specification example', () => {
    const entries = [
      purchase(22_000_000, '2026-08-01'),
      cost(1_700_000, 'REPAIR'),
    ]
    const result = expectedOutcome(
      { projectedRepairCost: rupiah(1_700_000), targetSellingPrice: rupiah(27_000_000) },
      entries,
    )
    expect(result?.expectedTotalCost).toBe(23_700_000n)
    expect(result?.expectedProfit).toBe(3_300_000n)
    expect(result?.expectedRoi).toBe(1392) // 13.9%
  })

  it('adds only the UNSPENT remainder of the repair budget', () => {
    const entries = [purchase(22_000_000, '2026-08-01'), cost(500_000, 'REPAIR')]
    const result = expectedOutcome(bike, entries)
    // 22.0M spent + 0.5M repaired, 1.5M of the 2.0M budget still to come.
    expect(result?.expectedTotalCost).toBe(24_000_000n)
  })

  it('does not double-count once repairs exceed the budget', () => {
    const entries = [purchase(22_000_000, '2026-08-01'), cost(3_000_000, 'REPAIR')]
    const result = expectedOutcome(bike, entries)
    expect(result?.expectedTotalCost).toBe(25_000_000n)
  })

  it('returns null rather than inventing a target price', () => {
    expect(expectedOutcome(motorcycle(), [purchase(1, '2026-08-01')])).toBeNull()
  })
})

describe('motorcycleFinancials()', () => {
  it('reports every §7 figure in one pass', () => {
    const f = motorcycleFinancials([
      purchase(21_500_000, '2026-08-04'),
      cost(450_000, 'REPAIR', '2026-08-05'),
      sale(26_000_000, '2026-08-27'),
    ])

    expect(f.purchasePrice).toBe(21_500_000n)
    expect(f.purchaseDate).toEqual(d('2026-08-04'))
    expect(f.additionalCosts).toBe(450_000n)
    expect(f.totalCost).toBe(21_950_000n)
    expect(f.salePrice).toBe(26_000_000n)
    expect(f.saleDate).toEqual(d('2026-08-27'))
    expect(f.netProfit).toBe(4_050_000n)
    expect(f.isSold).toBe(true)
  })

  it('marks an unsold bike as not sold and leaves sale fields null', () => {
    const f = motorcycleFinancials([purchase(21_500_000, '2026-08-04')])
    expect(f.isSold).toBe(false)
    expect(f.salePrice).toBeNull()
    expect(f.saleDate).toBeNull()
  })
})
