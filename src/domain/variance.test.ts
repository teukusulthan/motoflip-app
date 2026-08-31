import { describe, expect, it } from 'vitest'
import { cost, motorcycle, purchase, sale } from './__fixtures__/builders'
import { projectedOutcome, varianceReport } from './variance'
import { rupiah } from './money'

const planned = motorcycle({
  projectedPurchasePrice: rupiah(21_500_000),
  projectedRepairCost: rupiah(1_500_000),
  targetSellingPrice: rupiah(26_200_000),
})

describe('projectedOutcome()', () => {
  it('adds the repair budget to the expected purchase', () => {
    const p = projectedOutcome(planned)
    expect(p.projectedCost).toBe(23_000_000n)
    expect(p.projectedProfit).toBe(3_200_000n)
    expect(p.projectedRoi).toBe(1391)
  })

  it('treats a missing repair budget as zero, not as unknown', () => {
    const p = projectedOutcome({
      projectedPurchasePrice: rupiah(20_000_000),
      projectedRepairCost: null,
      targetSellingPrice: rupiah(24_000_000),
    })
    expect(p.projectedCost).toBe(20_000_000n)
    expect(p.projectedProfit).toBe(4_000_000n)
  })

  it('returns nulls rather than guessing when the purchase estimate is absent', () => {
    const p = projectedOutcome({
      projectedPurchasePrice: null,
      projectedRepairCost: rupiah(1_000_000),
      targetSellingPrice: rupiah(24_000_000),
    })
    expect(p.projectedCost).toBeNull()
    expect(p.projectedProfit).toBeNull()
    expect(p.projectedRoi).toBeNull()
  })
})

describe('varianceReport() — the §9 example', () => {
  const entries = [
    purchase(21_500_000, '2026-08-04'),
    cost(1_850_000, 'REPAIR', '2026-08-06'),
    sale(26_200_000, '2026-08-25'),
  ]

  const report = varianceReport(planned, entries)

  it('shows the projected and actual profit side by side', () => {
    expect(report.profit.projected).toBe(3_200_000n)
    expect(report.profit.actual).toBe(2_850_000n)
  })

  it('reports the shortfall as a negative delta', () => {
    expect(report.profit.delta).toBe(-350_000n)
  })

  it('labels a profit shortfall as worse', () => {
    expect(report.profit.direction).toBe('worse')
  })

  it('labels overspending on cost as worse, not better', () => {
    expect(report.cost.projected).toBe(23_000_000n)
    expect(report.cost.actual).toBe(23_350_000n)
    expect(report.cost.direction).toBe('worse')
  })

  it('labels hitting the target sale price exactly as on-target', () => {
    expect(report.sale.direction).toBe('on-target')
  })

  it('compares projected against actual ROI', () => {
    expect(report.projectedRoi).toBe(1391)
    expect(report.actualRoi).toBe(1221)
    expect(report.roiDeltaBps).toBe(-170)
  })
})

describe('varianceReport() before the sale', () => {
  const entries = [purchase(21_500_000, '2026-08-04')]
  const report = varianceReport(planned, entries)

  it('does not claim a profit variance for an unsold bike', () => {
    expect(report.profit.actual).toBeNull()
    expect(report.profit.direction).toBe('unknown')
    expect(report.actualRoi).toBeNull()
    expect(report.roiDeltaBps).toBeNull()
  })

  it('still grades the purchase price against the estimate', () => {
    expect(report.purchase.direction).toBe('on-target')
  })

  it('labels buying below the estimate as better', () => {
    const cheaper = varianceReport(planned, [purchase(20_000_000, '2026-08-04')])
    expect(cheaper.purchase.delta).toBe(-1_500_000n)
    expect(cheaper.purchase.direction).toBe('better')
  })
})
