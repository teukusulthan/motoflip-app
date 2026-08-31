'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { MotorcycleStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/server/auth'
import { getCategoryByRole, getDefaultAccount } from '@/data/finance'
import {
  type ActionState,
  amountSchema,
  dateSchema,
  optionalAmountSchema,
  toActionState,
} from '@/lib/validation'

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

const createSchema = z.object({
  brand: z.string().trim().min(1, 'Merek wajib diisi'),
  model: z.string().trim().min(1, 'Model wajib diisi'),
  variant: z.preprocess(emptyToNull, z.string().trim().nullable()),
  year: z.coerce
    .number()
    .int()
    .min(1970, 'Tahun tidak valid')
    .max(new Date().getFullYear() + 1, 'Tahun tidak valid'),
  color: z.preprocess(emptyToNull, z.string().trim().nullable()),
  mileage: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).nullable(),
  ),
  plateNumber: z.preprocess(emptyToNull, z.string().trim().nullable()),
  engineNumber: z.preprocess(emptyToNull, z.string().trim().nullable()),
  frameNumber: z.preprocess(emptyToNull, z.string().trim().nullable()),
  location: z.preprocess(emptyToNull, z.string().trim().nullable()),
  sellerName: z.preprocess(emptyToNull, z.string().trim().nullable()),
  sellerContact: z.preprocess(emptyToNull, z.string().trim().nullable()),
  notes: z.preprocess(emptyToNull, z.string().trim().nullable()),
  acquisitionSource: z.enum([
    'FACEBOOK_MARKETPLACE', 'OLX', 'DEALER', 'DIRECT_OWNER',
    'FRIEND', 'WORKSHOP', 'AUCTION', 'INSTAGRAM', 'OTHER',
  ]),
  status: z.nativeEnum(MotorcycleStatus),
  projectedRepairCost: optionalAmountSchema,
  targetSellingPrice: optionalAmountSchema,
  purchasePrice: optionalAmountSchema,
  purchaseDate: z.string(),
})

/**
 * Workflow 1 (§34) — add a motorcycle in under 60 seconds.
 *
 * When a purchase price is supplied, the motorcycle and its acquisition ledger
 * entry are written in ONE transaction: a bike can never exist with a purchase
 * price that failed to record, or vice versa.
 */
export async function createMotorcycle(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()

  const parsed = createSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const data = parsed.data
  const buying = data.purchasePrice !== null && data.purchasePrice > 0n

  if (buying && !/^\d{4}-\d{2}-\d{2}$/.test(data.purchaseDate)) {
    return {
      error: 'Tanggal pembelian wajib diisi jika harga beli dicantumkan.',
      fieldErrors: { purchaseDate: 'Tanggal pembelian wajib diisi' },
    }
  }

  let motorcycleId: string

  try {
    const [account, purchaseCategory] = buying
      ? await Promise.all([
          getDefaultAccount(userId),
          getCategoryByRole(userId, 'PURCHASE'),
        ])
      : [null, null]

    const occurredAt = buying
      ? dateSchema.parse(data.purchaseDate)
      : new Date()

    motorcycleId = await prisma.$transaction(async (tx) => {
      const bike = await tx.motorcycle.create({
        data: {
          userId,
          brand: data.brand,
          model: data.model,
          variant: data.variant,
          year: data.year,
          color: data.color,
          mileage: data.mileage,
          plateNumber: data.plateNumber,
          engineNumber: data.engineNumber,
          frameNumber: data.frameNumber,
          location: data.location,
          sellerName: data.sellerName,
          sellerContact: data.sellerContact,
          notes: data.notes,
          acquisitionSource: data.acquisitionSource,
          status: data.status,
          projectedPurchasePrice: data.purchasePrice,
          projectedRepairCost: data.projectedRepairCost,
          targetSellingPrice: data.targetSellingPrice,
        },
      })

      await tx.statusChange.create({
        data: {
          userId,
          motorcycleId: bike.id,
          fromStatus: null,
          toStatus: data.status,
          occurredAt,
        },
      })

      if (buying && account && purchaseCategory) {
        await tx.ledgerEntry.create({
          data: {
            userId,
            type: 'EXPENSE',
            amount: data.purchasePrice as bigint,
            occurredAt,
            accountId: account.id,
            motorcycleId: bike.id,
            categoryId: purchaseCategory.id,
            note: `Pembelian ${data.brand} ${data.model}`,
          },
        })
      }

      return bike.id
    })
  } catch (error) {
    console.error('createMotorcycle failed', error)
    return {
      error:
        'Motor tidak dapat disimpan. Data Anda tidak hilang — silakan coba lagi.',
    }
  }

  revalidatePath('/garasi')
  revalidatePath('/beranda')
  redirect(`/garasi/${motorcycleId}`)
}

const statusSchema = z.object({
  motorcycleId: z.string().min(1),
  status: z.nativeEnum(MotorcycleStatus),
})

export async function updateStatus(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = statusSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Status tidak valid.' }

  const bike = await prisma.motorcycle.findFirst({
    where: { id: parsed.data.motorcycleId, userId },
  })
  if (!bike) return { error: 'Motor tidak ditemukan.' }
  if (bike.status === parsed.data.status) return {}

  try {
    await prisma.$transaction([
      prisma.motorcycle.update({
        where: { id: bike.id },
        data: {
          status: parsed.data.status,
          listedAt:
            parsed.data.status === 'LISTED' && bike.listedAt === null
              ? new Date()
              : bike.listedAt,
        },
      }),
      prisma.statusChange.create({
        data: {
          userId,
          motorcycleId: bike.id,
          fromStatus: bike.status,
          toStatus: parsed.data.status,
          occurredAt: new Date(),
        },
      }),
    ])
  } catch (error) {
    console.error('updateStatus failed', error)
    return { error: 'Status tidak dapat diperbarui. Silakan coba lagi.' }
  }

  revalidatePath(`/garasi/${bike.id}`)
  revalidatePath('/garasi')
  revalidatePath('/beranda')
  return {}
}

const sellSchema = z.object({
  motorcycleId: z.string().min(1),
  amount: amountSchema,
  saleDate: dateSchema,
  accountId: z.string().min(1, 'Akun kas wajib dipilih'),
  note: z.string().trim().optional(),
})

/**
 * Workflow 4 (§34) — mark sold.
 *
 * Writes the sale as an INCOME entry and flips the status in one transaction.
 * Profit, ROI, holding period and cashflow impact all follow automatically
 * because they are derived, so nothing else has to be updated here.
 */
export async function markSold(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = sellSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const bike = await prisma.motorcycle.findFirst({
    where: { id: parsed.data.motorcycleId, userId },
  })
  if (!bike) return { error: 'Motor tidak ditemukan.' }

  const saleCategory = await getCategoryByRole(userId, 'SALE')

  const alreadySold = await prisma.ledgerEntry.findFirst({
    where: {
      motorcycleId: bike.id,
      categoryId: saleCategory.id,
      voidedAt: null,
    },
  })
  if (alreadySold) {
    return { error: 'Motor ini sudah tercatat terjual.' }
  }

  try {
    await prisma.$transaction([
      prisma.ledgerEntry.create({
        data: {
          userId,
          type: 'INCOME',
          amount: parsed.data.amount,
          occurredAt: parsed.data.saleDate,
          accountId: parsed.data.accountId,
          motorcycleId: bike.id,
          categoryId: saleCategory.id,
          note: parsed.data.note || `Penjualan ${bike.brand} ${bike.model}`,
        },
      }),
      prisma.motorcycle.update({
        where: { id: bike.id },
        data: { status: 'SOLD' },
      }),
      prisma.statusChange.create({
        data: {
          userId,
          motorcycleId: bike.id,
          fromStatus: bike.status,
          toStatus: 'SOLD',
          occurredAt: parsed.data.saleDate,
        },
      }),
    ])
  } catch (error) {
    console.error('markSold failed', error)
    return {
      error:
        'Penjualan tidak dapat disimpan. Data Anda tidak hilang — silakan coba lagi.',
    }
  }

  revalidatePath(`/garasi/${bike.id}`)
  revalidatePath('/garasi')
  revalidatePath('/beranda')
  revalidatePath('/analitik')
  return {}
}
