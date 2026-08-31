/**
 * Money primitive — §8.
 *
 * Rupiah is stored and computed as `bigint` in WHOLE RUPIAH. Indonesia's minor
 * unit (sen) has been defunct for decades: no marketplace, workshop or invoice
 * in this business quotes it, so scaling by 100 would buy no precision and only
 * inflate every stored number. Postgres column type is BIGINT.
 *
 * Floating point never touches a monetary value. Percentages are carried as
 * integer basis points (1 bps = 0.01%), and are divided down to a decimal only
 * at the moment of display.
 */

declare const rupiahBrand: unique symbol
declare const bpsBrand: unique symbol

/** Whole rupiah. Always use the constructors below — never cast. */
export type Rupiah = bigint & { readonly [rupiahBrand]: true }

/** Integer basis points. 1389 === 13.89%. */
export type BasisPoints = number & { readonly [bpsBrand]: true }

export const ZERO = 0n as Rupiah

/** Build a Rupiah from a bigint, number or numeric string. */
export function rupiah(value: bigint | number | string): Rupiah {
  if (typeof value === 'bigint') return value as Rupiah

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) {
      throw new TypeError(`Cannot build Rupiah from non-finite number: ${value}`)
    }
    if (!Number.isInteger(value)) {
      throw new TypeError(
        `Rupiah must be a whole number, received ${value}. Round before constructing.`,
      )
    }
    // Beyond MAX_SAFE_INTEGER the argument has ALREADY lost precision before
    // reaching us, so accepting it would silently store a wrong amount. Callers
    // with figures that large must pass a bigint or a string.
    if (!Number.isSafeInteger(value)) {
      throw new TypeError(
        `Rupiah ${value} exceeds the safe integer range. Pass a bigint or string instead.`,
      )
    }
    return BigInt(value) as Rupiah
  }

  const trimmed = value.trim()
  if (!/^-?\d+$/.test(trimmed)) {
    throw new TypeError(`Cannot build Rupiah from string: "${value}"`)
  }
  return BigInt(trimmed) as Rupiah
}

/** Parse user input that may contain id-ID grouping separators, "Rp", spaces. */
export function parseRupiahInput(raw: string): Rupiah | null {
  const cleaned = raw.replace(/[^\d-]/g, '')
  if (cleaned === '' || cleaned === '-') return null
  return rupiah(cleaned)
}

export const addRupiah = (a: Rupiah, b: Rupiah): Rupiah => (a + b) as Rupiah
export const subRupiah = (a: Rupiah, b: Rupiah): Rupiah => (a - b) as Rupiah
export const negateRupiah = (a: Rupiah): Rupiah => -a as Rupiah
export const absRupiah = (a: Rupiah): Rupiah => (a < 0n ? -a : a) as Rupiah

export function sumRupiah(values: readonly Rupiah[]): Rupiah {
  let total = 0n
  for (const value of values) total += value
  return total as Rupiah
}

export const isZero = (a: Rupiah): boolean => a === 0n
export const isNegative = (a: Rupiah): boolean => a < 0n
export const isPositive = (a: Rupiah): boolean => a > 0n

/**
 * Integer division rounded half away from zero.
 *
 * bigint `/` truncates toward zero, which would bias every derived percentage
 * downward in magnitude. Rounding is defined here, once, so that every figure
 * in the application rounds identically.
 */
export function divRound(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw new RangeError('divRound: division by zero')
  }
  const negative = numerator < 0n !== denominator < 0n
  const n = numerator < 0n ? -numerator : numerator
  const d = denominator < 0n ? -denominator : denominator

  const quotient = n / d
  const remainder = n % d
  const rounded = remainder * 2n >= d ? quotient + 1n : quotient

  return negative ? -rounded : rounded
}

/**
 * Ratio of two rupiah amounts as integer basis points.
 *
 * Returns `null` when the base is zero: a return on zero investment is
 * undefined, not infinite. Callers render `—` rather than a number.
 */
export function ratioToBps(value: Rupiah, base: Rupiah): BasisPoints | null {
  if (base === 0n) return null
  return Number(divRound(value * 10_000n, base)) as BasisPoints
}

export const bps = (value: number): BasisPoints => Math.round(value) as BasisPoints

/** Basis points as a decimal percentage, for display only. */
export const bpsToPercent = (value: BasisPoints): number => value / 100

/** Apply a basis-point rate to an amount, rounded half away from zero. */
export function applyBps(amount: Rupiah, rate: BasisPoints): Rupiah {
  return divRound(amount * BigInt(rate), 10_000n) as Rupiah
}
