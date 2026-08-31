import { describe, expect, it } from 'vitest'
import {
  applyBps,
  divRound,
  parseRupiahInput,
  ratioToBps,
  rupiah,
  sumRupiah,
} from './money'

describe('rupiah()', () => {
  it('accepts bigint, integer number and numeric string', () => {
    expect(rupiah(21_500_000n)).toBe(21_500_000n)
    expect(rupiah(21_500_000)).toBe(21_500_000n)
    expect(rupiah('21500000')).toBe(21_500_000n)
    expect(rupiah('-450000')).toBe(-450_000n)
  })

  it('refuses fractional numbers rather than silently rounding', () => {
    expect(() => rupiah(1000.5)).toThrow(/whole number/)
  })

  it('refuses non-finite numbers', () => {
    expect(() => rupiah(Number.NaN)).toThrow(/non-finite/)
    expect(() => rupiah(Number.POSITIVE_INFINITY)).toThrow(/non-finite/)
  })

  it('refuses malformed strings', () => {
    expect(() => rupiah('Rp21.500.000')).toThrow()
    expect(() => rupiah('')).toThrow()
  })
})

describe('parseRupiahInput()', () => {
  it('strips id-ID grouping, currency prefix and stray spaces', () => {
    expect(parseRupiahInput('Rp21.500.000')).toBe(21_500_000n)
    expect(parseRupiahInput('21 500 000')).toBe(21_500_000n)
    expect(parseRupiahInput('300.000')).toBe(300_000n)
  })

  it('returns null for empty input instead of zero', () => {
    // Distinguishing "nothing typed" from "typed 0" matters for optional fields.
    expect(parseRupiahInput('')).toBeNull()
    expect(parseRupiahInput('Rp')).toBeNull()
    expect(parseRupiahInput('-')).toBeNull()
  })
})

describe('divRound()', () => {
  it('rounds half away from zero, not toward it', () => {
    expect(divRound(5n, 2n)).toBe(3n)
    expect(divRound(-5n, 2n)).toBe(-3n)
    expect(divRound(4n, 2n)).toBe(2n)
    expect(divRound(1n, 3n)).toBe(0n)
    expect(divRound(2n, 3n)).toBe(1n)
  })

  it('throws on division by zero rather than returning a sentinel', () => {
    expect(() => divRound(1n, 0n)).toThrow(RangeError)
  })
})

describe('ratioToBps()', () => {
  it('expresses a ratio as integer basis points', () => {
    // 3,280,000 / 22,720,000 = 14.436...% -> 1444 bps
    expect(ratioToBps(rupiah(3_280_000), rupiah(22_720_000))).toBe(1444)
  })

  it('handles a loss as negative basis points', () => {
    expect(ratioToBps(rupiah(-1_000_000), rupiah(20_000_000))).toBe(-500)
  })

  it('returns null for a zero base instead of Infinity', () => {
    expect(ratioToBps(rupiah(5_000_000), rupiah(0))).toBeNull()
  })
})

describe('sumRupiah()', () => {
  it('sums an empty list to zero', () => {
    expect(sumRupiah([])).toBe(0n)
  })

  it('stays exact across sums that would overflow double precision', () => {
    const values = Array.from({ length: 1000 }, () =>
      rupiah(9_007_199_254_740_993n),
    )
    expect(sumRupiah(values)).toBe(9_007_199_254_740_993_000n)
  })

  it('rejects a number argument that has already lost precision', () => {
    // 9_007_199_254_740_993 is not representable as a double: the literal
    // silently becomes ...992 before rupiah() is even called.
    expect(() => rupiah(9_007_199_254_740_993)).toThrow(/safe integer range/)
  })
})

describe('applyBps()', () => {
  it('applies a rate with deterministic rounding', () => {
    expect(applyBps(rupiah(22_720_000), 1444 as never)).toBe(3_280_768n)
  })
})
