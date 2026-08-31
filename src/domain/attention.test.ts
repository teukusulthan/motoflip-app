import { describe, expect, it } from 'vitest'
import { cost, d, motorcycle, purchase } from './__fixtures__/builders'
import { DEFAULT_THRESHOLDS, buildAttentionItems } from './attention'
import { rupiah } from './money'

const asOf = d('2026-08-31')

describe('buildAttentionItems() (§4)', () => {
  it('is empty when nothing needs attention', () => {
    const bikes = [motorcycle({ id: 'a', status: 'OWNED' })]
    const entries = [purchase(20_000_000, '2026-08-20', 'a')]
    expect(buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)).toEqual([])
  })

  it('flags a bike held longer than the warning threshold', () => {
    const bikes = [motorcycle({ id: 'a', status: 'OWNED' })]
    // 45 days: past the 30-day warning threshold, short of the 60-day critical one.
    const entries = [purchase(20_000_000, '2026-07-17', 'a')]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    const aging = items.find((i) => i.kind === 'AGING')
    expect(aging?.severity).toBe('warning')
    expect(aging?.title).toContain('45 hari')
  })

  it('escalates to danger past the critical threshold', () => {
    const bikes = [motorcycle({ id: 'a', status: 'OWNED' })]
    const entries = [purchase(20_000_000, '2026-05-01', 'a')]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.kind === 'AGING')?.severity).toBe('danger')
  })

  it('ignores sold bikes entirely', () => {
    const bikes = [motorcycle({ id: 'a', status: 'SOLD' })]
    const entries = [purchase(20_000_000, '2026-01-01', 'a')]
    expect(buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)).toEqual([])
  })

  it('flags repair spending well over the budget', () => {
    const bikes = [
      motorcycle({ id: 'a', status: 'PREPARATION', projectedRepairCost: rupiah(1_000_000) }),
    ]
    const entries = [
      purchase(20_000_000, '2026-08-25', 'a'),
      cost(1_500_000, 'REPAIR', '2026-08-28', 'a'),
    ]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.kind === 'REPAIR_OVERRUN')).toBeDefined()
  })

  it('does not flag a small, tolerable overrun', () => {
    const bikes = [
      motorcycle({ id: 'a', status: 'PREPARATION', projectedRepairCost: rupiah(1_000_000) }),
    ]
    const entries = [
      purchase(20_000_000, '2026-08-25', 'a'),
      cost(1_050_000, 'REPAIR', '2026-08-28', 'a'),
    ]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.kind === 'REPAIR_OVERRUN')).toBeUndefined()
  })

  it('flags a thin expected margin against the target price', () => {
    const bikes = [
      motorcycle({ id: 'a', status: 'OWNED', targetSellingPrice: rupiah(21_000_000) }),
    ]
    const entries = [purchase(20_000_000, '2026-08-25', 'a')]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.kind === 'LOW_MARGIN')?.severity).toBe('warning')
  })

  it('escalates a projected loss to danger', () => {
    const bikes = [
      motorcycle({ id: 'a', status: 'OWNED', targetSellingPrice: rupiah(19_000_000) }),
    ]
    const entries = [purchase(20_000_000, '2026-08-25', 'a')]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.kind === 'LOW_MARGIN')?.severity).toBe('danger')
  })

  it('flags a ready bike that was never listed', () => {
    const bikes = [motorcycle({ id: 'a', status: 'READY_TO_SELL', listedAt: null })]
    const entries = [purchase(20_000_000, '2026-08-25', 'a')]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.kind === 'NOT_LISTED')).toBeDefined()
  })

  it('flags a listing that has gone stale', () => {
    const bikes = [
      motorcycle({ id: 'a', status: 'LISTED', listedAt: d('2026-08-01') }),
    ]
    const entries = [purchase(20_000_000, '2026-08-25', 'a')]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.kind === 'LISTED_TOO_LONG')?.title).toContain('30 hari')
  })

  it('warns before a document expires and escalates once it has', () => {
    const docs = [
      { id: 'd1', motorcycleId: 'a', label: 'STNK', expiresAt: d('2026-09-10') },
      { id: 'd2', motorcycleId: 'a', label: 'BPKB', expiresAt: d('2026-08-01') },
    ]
    const items = buildAttentionItems([], [], docs, DEFAULT_THRESHOLDS, asOf)
    expect(items.find((i) => i.id === 'doc:d1')?.severity).toBe('warning')
    expect(items.find((i) => i.id === 'doc:d2')?.severity).toBe('danger')
    expect(items.find((i) => i.id === 'doc:d2')?.title).toContain('kedaluwarsa')
  })

  it('sorts the most severe items first', () => {
    const bikes = [
      motorcycle({ id: 'a', status: 'READY_TO_SELL', listedAt: null }),
      motorcycle({ id: 'b', status: 'OWNED' }),
    ]
    const entries = [
      purchase(20_000_000, '2026-08-25', 'a'),
      purchase(20_000_000, '2026-01-01', 'b'),
    ]
    const items = buildAttentionItems(bikes, entries, [], DEFAULT_THRESHOLDS, asOf)
    expect(items[0]?.severity).toBe('danger')
  })
})
