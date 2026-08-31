import { describe, expect, it } from 'vitest'
import {
  differenceInCalendarDays,
  endOfMonthUtc,
  isWithin,
  startOfMonthUtc,
  toUtcMidnight,
} from './dates'

const d = (iso: string) => new Date(iso)

describe('toUtcMidnight()', () => {
  it('strips the time component', () => {
    expect(toUtcMidnight(d('2026-08-31T17:45:12.345Z')).toISOString()).toBe(
      '2026-08-31T00:00:00.000Z',
    )
  })

  it('is idempotent', () => {
    const once = toUtcMidnight(d('2026-08-31T17:45:00Z'))
    expect(toUtcMidnight(once).getTime()).toBe(once.getTime())
  })
})

describe('differenceInCalendarDays()', () => {
  it('counts whole calendar days regardless of time of day', () => {
    // A purchase late in the evening and a sale early the next morning is one
    // day, not zero — this is why day maths is calendar-based, not elapsed-ms.
    expect(
      differenceInCalendarDays(
        d('2026-08-04T23:30:00Z'),
        d('2026-08-05T00:30:00Z'),
      ),
    ).toBe(1)
  })

  it('is zero for the same day', () => {
    expect(
      differenceInCalendarDays(d('2026-08-04T01:00:00Z'), d('2026-08-04T23:00:00Z')),
    ).toBe(0)
  })

  it('is negative when the end precedes the start', () => {
    expect(
      differenceInCalendarDays(d('2026-08-10T00:00:00Z'), d('2026-08-04T00:00:00Z')),
    ).toBe(-6)
  })

  it('spans month and year boundaries correctly', () => {
    expect(
      differenceInCalendarDays(d('2026-12-25T00:00:00Z'), d('2027-01-05T00:00:00Z')),
    ).toBe(11)
  })

  it('handles a leap day', () => {
    expect(
      differenceInCalendarDays(d('2028-02-28T00:00:00Z'), d('2028-03-01T00:00:00Z')),
    ).toBe(2)
  })
})

describe('month boundaries', () => {
  it('finds the first instant of the month', () => {
    expect(startOfMonthUtc(d('2026-08-31T17:00:00Z')).toISOString()).toBe(
      '2026-08-01T00:00:00.000Z',
    )
  })

  it('finds the last instant of the month', () => {
    expect(endOfMonthUtc(d('2026-08-01T00:00:00Z')).toISOString()).toBe(
      '2026-08-31T23:59:59.999Z',
    )
  })

  it('handles February in a leap year', () => {
    expect(endOfMonthUtc(d('2028-02-10T00:00:00Z')).toISOString()).toBe(
      '2028-02-29T23:59:59.999Z',
    )
  })

  it('handles December without rolling the year wrong', () => {
    expect(endOfMonthUtc(d('2026-12-05T00:00:00Z')).toISOString()).toBe(
      '2026-12-31T23:59:59.999Z',
    )
  })
})

describe('isWithin()', () => {
  const from = d('2026-08-01T00:00:00Z')
  const to = d('2026-08-31T23:59:59.999Z')

  it('includes both boundaries', () => {
    expect(isWithin(from, from, to)).toBe(true)
    expect(isWithin(to, from, to)).toBe(true)
  })

  it('excludes dates outside the range', () => {
    expect(isWithin(d('2026-07-31T23:59:59Z'), from, to)).toBe(false)
    expect(isWithin(d('2026-09-01T00:00:00Z'), from, to)).toBe(false)
  })
})
