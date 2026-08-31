import { z } from 'zod'

/**
 * A rupiah amount as posted by MoneyInput: a bare digit string.
 * Parsed straight to bigint so no float ever exists, even transiently.
 */
export const amountSchema = z
  .string()
  .trim()
  .min(1, 'Jumlah wajib diisi')
  .regex(/^\d+$/, 'Jumlah hanya boleh berisi angka')
  .transform((value) => BigInt(value))

export const optionalAmountSchema = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .refine((value) => value === null || /^\d+$/.test(value), {
    message: 'Jumlah hanya boleh berisi angka',
  })
  .transform((value) => (value === null ? null : BigInt(value)))

/** A yyyy-mm-dd date input, read as UTC midnight to keep day maths exact. */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid')
  .transform((value) => new Date(`${value}T00:00:00.000Z`))

export const optionalText = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()

export const optionalId = z
  .string()
  .trim()
  .transform((value) => (value === '' ? null : value))
  .nullable()

export type ActionState = { error?: string; fieldErrors?: Record<string, string> }

/** Turn a ZodError into the shape the forms render. */
export function toActionState(error: z.ZodError): ActionState {
  const fieldErrors: Record<string, string> = {}
  for (const issue of error.issues) {
    const key = issue.path.join('.')
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return {
    error: 'Periksa kembali isian yang ditandai.',
    fieldErrors,
  }
}
