'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { CashAccountKind } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/server/auth'
import {
  type ActionState,
  optionalAmountSchema,
  toActionState,
} from '@/lib/validation'
import { slugify } from '@/lib/slug'

const emptyToNull = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? null : value

/** §18 — the ageing and warning thresholds are user-configurable. */
const thresholdSchema = z
  .object({
    agingWarnDays: z.coerce.number().int().min(1).max(365),
    agingCriticalDays: z.coerce.number().int().min(1).max(730),
    repairOverrunPercent: z.coerce.number().int().min(0).max(500),
    lowMarginPercent: z.coerce.number().int().min(0).max(100),
  })
  .refine((v) => v.agingCriticalDays > v.agingWarnDays, {
    message: 'Ambang kritis harus lebih besar dari ambang peringatan',
    path: ['agingCriticalDays'],
  })

export async function updateSettings(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()

  const parsed = thresholdSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  try {
    await prisma.settings.upsert({
      where: { userId },
      update: {
        agingWarnDays: parsed.data.agingWarnDays,
        agingCriticalDays: parsed.data.agingCriticalDays,
        // Percentages are entered by the user but stored as basis points, so
        // the domain layer never sees a percentage.
        repairOverrunWarnBps: parsed.data.repairOverrunPercent * 100,
        lowMarginWarnBps: parsed.data.lowMarginPercent * 100,
      },
      create: {
        userId,
        agingWarnDays: parsed.data.agingWarnDays,
        agingCriticalDays: parsed.data.agingCriticalDays,
        repairOverrunWarnBps: parsed.data.repairOverrunPercent * 100,
        lowMarginWarnBps: parsed.data.lowMarginPercent * 100,
      },
    })
  } catch (error) {
    console.error('updateSettings failed', error)
    return { error: 'Pengaturan tidak dapat disimpan. Silakan coba lagi.' }
  }

  revalidatePath('/beranda')
  revalidatePath('/lainnya/pengaturan')
  return {}
}

// ---------------------------------------------------------------- vendors --

const vendorSchema = z.object({
  vendorId: z.preprocess(emptyToNull, z.string().nullable()),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(120),
  category: z.preprocess(emptyToNull, z.string().trim().max(80).nullable()),
  phone: z.preprocess(emptyToNull, z.string().trim().max(40).nullable()),
  address: z.preprocess(emptyToNull, z.string().trim().max(300).nullable()),
  notes: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
})

/** §20 — vendor/workshop management. */
export async function saveVendor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = vendorSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const { vendorId, ...data } = parsed.data

  try {
    if (vendorId) {
      const existing = await prisma.vendor.findFirst({
        where: { id: vendorId, userId },
        select: { id: true },
      })
      if (!existing) return { error: 'Vendor tidak ditemukan.' }
      await prisma.vendor.update({ where: { id: existing.id }, data })
    } else {
      await prisma.vendor.create({ data: { ...data, userId } })
    }
  } catch (error) {
    console.error('saveVendor failed', error)
    return { error: 'Vendor tidak dapat disimpan. Silakan coba lagi.' }
  }

  revalidatePath('/lainnya/vendor')
  revalidatePath('/analitik')
  return {}
}

/**
 * §38 — archived, not deleted.
 *
 * A vendor is referenced by historical ledger entries; removing the row would
 * orphan real spending records.
 */
export async function archiveVendor(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const id = String(formData.get('vendorId') ?? '')
  if (!id) return { error: 'Vendor tidak valid.' }

  const vendor = await prisma.vendor.findFirst({ where: { id, userId } })
  if (!vendor) return { error: 'Vendor tidak ditemukan.' }

  await prisma.vendor.update({
    where: { id: vendor.id },
    data: { archivedAt: vendor.archivedAt ? null : new Date() },
  })

  revalidatePath('/lainnya/vendor')
  return {}
}

// ----------------------------------------------------------- cash accounts --

const accountSchema = z.object({
  accountId: z.preprocess(emptyToNull, z.string().nullable()),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(80),
  kind: z.nativeEnum(CashAccountKind),
  openingBalance: optionalAmountSchema,
})

export async function saveCashAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = accountSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const { accountId, name, kind, openingBalance } = parsed.data

  try {
    if (accountId) {
      const existing = await prisma.cashAccount.findFirst({
        where: { id: accountId, userId },
        select: { id: true },
      })
      if (!existing) return { error: 'Akun tidak ditemukan.' }
      await prisma.cashAccount.update({
        where: { id: existing.id },
        data: { name, kind, openingBalance: openingBalance ?? 0n },
      })
    } else {
      await prisma.cashAccount.create({
        data: { userId, name, kind, openingBalance: openingBalance ?? 0n },
      })
    }
  } catch (error) {
    console.error('saveCashAccount failed', error)
    return { error: 'Akun kas tidak dapat disimpan. Silakan coba lagi.' }
  }

  revalidatePath('/lainnya')
  revalidatePath('/lainnya/akun-kas')
  revalidatePath('/beranda')
  return {}
}

/** Archived rather than deleted — entries reference the account (§38). */
export async function archiveCashAccount(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const id = String(formData.get('accountId') ?? '')
  if (!id) return { error: 'Akun tidak valid.' }

  const account = await prisma.cashAccount.findFirst({ where: { id, userId } })
  if (!account) return { error: 'Akun tidak ditemukan.' }

  if (!account.archivedAt) {
    const remaining = await prisma.cashAccount.count({
      where: { userId, archivedAt: null },
    })
    if (remaining <= 1) {
      return { error: 'Minimal satu akun kas harus tetap aktif.' }
    }
  }

  await prisma.cashAccount.update({
    where: { id: account.id },
    data: { archivedAt: account.archivedAt ? null : new Date() },
  })

  revalidatePath('/lainnya')
  revalidatePath('/lainnya/akun-kas')
  revalidatePath('/beranda')
  return {}
}

// -------------------------------------------------------------- categories --

const categorySchema = z.object({
  categoryId: z.preprocess(emptyToNull, z.string().nullable()),
  name: z.string().trim().min(1, 'Nama wajib diisi').max(60),
  kind: z.enum(['INCOME', 'EXPENSE']),
  group: z.enum([
    'ACQUISITION', 'REPAIR', 'MAINTENANCE', 'DOCUMENTATION',
    'LOGISTICS', 'SELLING', 'OTHER', 'SALE', 'OTHER_INCOME',
  ]),
})

/** §10 — categories are configurable. */
export async function saveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = categorySchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const { categoryId, name, kind, group } = parsed.data

  try {
    if (categoryId) {
      const existing = await prisma.category.findFirst({
        where: { id: categoryId, userId },
      })
      if (!existing) return { error: 'Kategori tidak ditemukan.' }
      // A system category's role and kind carry structural meaning; only the
      // display name may change.
      await prisma.category.update({
        where: { id: existing.id },
        data: existing.isSystem ? { name } : { name, kind, group },
      })
    } else {
      const base = slugify(name)
      if (!base) return { error: 'Nama kategori tidak valid.' }

      // Ensure the slug is unique for this user.
      let slug = base
      for (let i = 2; i < 50; i += 1) {
        const clash = await prisma.category.findUnique({
          where: { userId_slug: { userId, slug } },
        })
        if (!clash) break
        slug = `${base}-${i}`
      }

      await prisma.category.create({
        data: { userId, slug, name, kind, group, isSystem: false },
      })
    }
  } catch (error) {
    console.error('saveCategory failed', error)
    return { error: 'Kategori tidak dapat disimpan. Silakan coba lagi.' }
  }

  revalidatePath('/lainnya/kategori')
  revalidatePath('/transaksi/pengeluaran')
  revalidatePath('/transaksi/pemasukan')
  return {}
}

export async function archiveCategory(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const id = String(formData.get('categoryId') ?? '')
  if (!id) return { error: 'Kategori tidak valid.' }

  const category = await prisma.category.findFirst({ where: { id, userId } })
  if (!category) return { error: 'Kategori tidak ditemukan.' }

  if (category.isSystem && !category.archivedAt) {
    return {
      error:
        'Kategori sistem tidak dapat diarsipkan karena dipakai oleh alur pembelian dan penjualan.',
    }
  }

  await prisma.category.update({
    where: { id: category.id },
    data: { archivedAt: category.archivedAt ? null : new Date() },
  })

  revalidatePath('/lainnya/kategori')
  return {}
}
