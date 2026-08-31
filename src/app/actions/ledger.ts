'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/server/auth'
import {
  type ActionState,
  amountSchema,
  dateSchema,
  toActionState,
} from '@/lib/validation'

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const entrySchema = z.object({
  amount: amountSchema,
  occurredAt: dateSchema,
  accountId: z.string().min(1, 'Akun kas wajib dipilih'),
  categoryId: z.string().min(1, 'Kategori wajib dipilih'),
  motorcycleId: z.preprocess(emptyToNull, z.string().nullable()),
  vendorId: z.preprocess(emptyToNull, z.string().nullable()),
  note: z.preprocess(emptyToNull, z.string().trim().nullable()),
})

/**
 * Workflow 2 (§34) — record an expense in under 15 seconds.
 *
 * Every id supplied by the client is re-checked against the signed-in user
 * before it is written: an id in a form field is never trusted (§45).
 */
export async function createExpense(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return createEntry('EXPENSE', formData)
}

export async function createIncome(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  return createEntry('INCOME', formData)
}

async function createEntry(
  type: 'EXPENSE' | 'INCOME',
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()

  const parsed = entrySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const data = parsed.data

  const [account, category, motorcycle, vendor] = await Promise.all([
    prisma.cashAccount.findFirst({ where: { id: data.accountId, userId } }),
    prisma.category.findFirst({ where: { id: data.categoryId, userId } }),
    data.motorcycleId
      ? prisma.motorcycle.findFirst({ where: { id: data.motorcycleId, userId } })
      : Promise.resolve(null),
    data.vendorId
      ? prisma.vendor.findFirst({ where: { id: data.vendorId, userId } })
      : Promise.resolve(null),
  ])

  if (!account) return { error: 'Akun kas tidak ditemukan.' }
  if (!category) return { error: 'Kategori tidak ditemukan.' }
  if (data.motorcycleId && !motorcycle) return { error: 'Motor tidak ditemukan.' }
  if (data.vendorId && !vendor) return { error: 'Vendor tidak ditemukan.' }

  if (category.kind !== type) {
    return { error: 'Kategori tidak sesuai dengan jenis transaksi.' }
  }

  // The purchase and sale roles are written by their own dedicated flows, which
  // also move the motorcycle's lifecycle. Allowing them here would let a bike
  // acquire a second purchase or a sale without changing status.
  if (category.role !== 'NORMAL') {
    return {
      error:
        'Gunakan menu Tambah Motor atau Tandai Terjual untuk mencatat pembelian dan penjualan.',
    }
  }

  try {
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type,
        amount: data.amount,
        occurredAt: data.occurredAt,
        accountId: account.id,
        motorcycleId: motorcycle?.id ?? null,
        categoryId: category.id,
        vendorId: vendor?.id ?? null,
        note: data.note,
      },
    })
  } catch (error) {
    console.error('createEntry failed', error)
    return {
      error:
        'Transaksi tidak dapat disimpan. Data Anda tidak hilang — silakan coba lagi.',
    }
  }

  revalidatePath('/beranda')
  revalidatePath('/analitik')
  revalidatePath('/transaksi')
  if (motorcycle) revalidatePath(`/garasi/${motorcycle.id}`)
  return {}
}

const transferSchema = z.object({
  amount: amountSchema,
  occurredAt: dateSchema,
  accountId: z.string().min(1, 'Akun asal wajib dipilih'),
  toAccountId: z.string().min(1, 'Akun tujuan wajib dipilih'),
  note: z.preprocess(emptyToNull, z.string().trim().nullable()),
})

/** §15 — a transfer moves money without touching profit. */
export async function createTransfer(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()

  const parsed = transferSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const data = parsed.data
  if (data.accountId === data.toAccountId) {
    return { error: 'Akun asal dan tujuan tidak boleh sama.' }
  }

  const accounts = await prisma.cashAccount.findMany({
    where: { userId, id: { in: [data.accountId, data.toAccountId] } },
  })
  if (accounts.length !== 2) return { error: 'Akun kas tidak ditemukan.' }

  const category = await prisma.category.findFirst({
    where: { userId, slug: 'lainnya' },
  })
  if (!category) return { error: 'Kategori sistem tidak ditemukan.' }

  try {
    await prisma.ledgerEntry.create({
      data: {
        userId,
        type: 'TRANSFER',
        amount: data.amount,
        occurredAt: data.occurredAt,
        accountId: data.accountId,
        toAccountId: data.toAccountId,
        categoryId: category.id,
        note: data.note,
      },
    })
  } catch (error) {
    console.error('createTransfer failed', error)
    return { error: 'Transfer tidak dapat disimpan. Silakan coba lagi.' }
  }

  revalidatePath('/beranda')
  revalidatePath('/transaksi')
  return {}
}

const voidSchema = z.object({
  entryId: z.string().min(1),
  reason: z.preprocess(emptyToNull, z.string().trim().nullable()),
})

/**
 * §38 — a correction never mutates history.
 *
 * The original entry is marked voided (so it drops out of every calculation)
 * and stays in the database as an auditable record of what was originally
 * entered and when it was reversed.
 */
export async function voidEntry(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()

  const parsed = voidSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Transaksi tidak valid.' }

  const entry = await prisma.ledgerEntry.findFirst({
    where: { id: parsed.data.entryId, userId },
  })
  if (!entry) return { error: 'Transaksi tidak ditemukan.' }
  if (entry.voidedAt) return { error: 'Transaksi ini sudah dibatalkan.' }

  try {
    await prisma.ledgerEntry.update({
      where: { id: entry.id },
      data: { voidedAt: new Date(), voidReason: parsed.data.reason },
    })
  } catch (error) {
    console.error('voidEntry failed', error)
    return { error: 'Transaksi tidak dapat dibatalkan. Silakan coba lagi.' }
  }

  revalidatePath('/beranda')
  revalidatePath('/analitik')
  revalidatePath('/transaksi')
  if (entry.motorcycleId) revalidatePath(`/garasi/${entry.motorcycleId}`)
  return {}
}
