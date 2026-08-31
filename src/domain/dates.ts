/**
 * Calendar-day arithmetic.
 *
 * Dates the user picks (purchase date, sale date, expense date) are normalised
 * to UTC midnight at the data boundary, so day differences here are exact and
 * never drift by one across a timezone offset.
 */

export const MS_PER_DAY = 86_400_000

/** Strip the time component, keeping the calendar date in UTC. */
export function toUtcMidnight(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
}

/** Whole calendar days from `from` to `to`. Negative if `to` precedes `from`. */
export function differenceInCalendarDays(from: Date, to: Date): number {
  return Math.round(
    (toUtcMidnight(to).getTime() - toUtcMidnight(from).getTime()) / MS_PER_DAY,
  )
}

export function startOfMonthUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
}

export function endOfMonthUtc(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - 1,
  )
}

export function isWithin(date: Date, from: Date, to: Date): boolean {
  const t = date.getTime()
  return t >= from.getTime() && t <= to.getTime()
}
