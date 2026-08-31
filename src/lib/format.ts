/**
 * Presentation formatting — id-ID.
 *
 * Kept out of src/domain deliberately: the domain deals in exact integers, and
 * every lossy conversion to a human-readable string happens here, once.
 */
import type { BasisPoints, Rupiah } from '@/domain/money'

const groupFormatter = new Intl.NumberFormat('id-ID')

/** "Rp22.720.000" — the exact figure, for detail views and forms. */
export function formatRupiah(value: Rupiah | bigint | null | undefined): string {
  if (value === null || value === undefined) return '—'
  return `Rp${groupFormatter.format(value)}`
}

/** "22.720.000" — no currency prefix, for inputs. */
export function formatGrouped(value: Rupiah | bigint | null | undefined): string {
  if (value === null || value === undefined) return ''
  return groupFormatter.format(value)
}

/**
 * "Rp22,7jt" — compact, for dashboard tiles where space is tight (§44).
 * Never used where the user needs the exact number.
 */
export function formatRupiahCompact(
  value: Rupiah | bigint | null | undefined,
): string {
  if (value === null || value === undefined) return '—'

  const negative = value < 0n
  const abs = negative ? -value : value
  const sign = negative ? '-' : ''

  if (abs >= 1_000_000_000n) {
    return `${sign}Rp${oneDecimal(abs, 1_000_000_000n)}M`
  }
  if (abs >= 1_000_000n) {
    return `${sign}Rp${oneDecimal(abs, 1_000_000n)}jt`
  }
  if (abs >= 1_000n) {
    return `${sign}Rp${oneDecimal(abs, 1_000n)}rb`
  }
  return `${sign}Rp${abs.toString()}`
}

/** Integer maths only: one decimal place without ever building a float. */
function oneDecimal(abs: bigint, unit: bigint): string {
  const tenths = (abs * 10n) / unit
  const whole = tenths / 10n
  const frac = tenths % 10n
  return frac === 0n ? whole.toString() : `${whole},${frac}`
}

/** "13,9%" */
export function formatPercent(
  value: BasisPoints | number | null | undefined,
  fractionDigits = 1,
): string {
  if (value === null || value === undefined) return '—'
  return `${(value / 100).toLocaleString('id-ID', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}%`
}

/** "+13,9%" / "-4,2%" — for deltas where direction matters. */
export function formatPercentSigned(
  value: BasisPoints | number | null | undefined,
): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatPercent(value)}`
}

export function formatRupiahSigned(
  value: Rupiah | bigint | null | undefined,
): string {
  if (value === null || value === undefined) return '—'
  const sign = value > 0n ? '+' : ''
  return `${sign}${formatRupiah(value)}`
}

const dateFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
})

const dayMonthFormatter = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
})

export function formatDate(value: Date | null | undefined): string {
  if (!value) return '—'
  return dateFormatter.format(value)
}

export function formatDayMonth(value: Date | null | undefined): string {
  if (!value) return '—'
  return dayMonthFormatter.format(value)
}

/** For <input type="date">, which always wants ISO yyyy-mm-dd. */
export function toDateInputValue(value: Date | null | undefined): string {
  if (!value) return ''
  return value.toISOString().slice(0, 10)
}

/**
 * Read a date input back as UTC midnight, matching the convention the domain
 * layer relies on for exact calendar-day arithmetic.
 */
export function fromDateInputValue(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`)
}

export function formatDays(days: number | null | undefined): string {
  if (days === null || days === undefined) return '—'
  return `${days} hari`
}
