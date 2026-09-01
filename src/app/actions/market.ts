'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { AcquisitionSource } from '@prisma/client'
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

const modelSchema = z.object({
  brand: z.string().trim().min(1, 'Merek wajib diisi'),
  model: z.string().trim().min(1, 'Model wajib diisi'),
  variant: z.preprocess(emptyToNull, z.string().trim().nullable()),
  year: z.coerce
    .number()
    .int()
    .min(1970, 'Tahun tidak valid')
    .max(new Date().getFullYear() + 1, 'Tahun tidak valid'),
})

/** §25 — models are tracked at model+year granularity. */
export async function trackModel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = modelSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const { brand, model, variant, year } = parsed.data

  try {
    const created = await prisma.marketModel.upsert({
      where: { userId_brand_model_year: { userId, brand, model, year } },
      update: { variant },
      create: { userId, brand, model, variant, year },
    })
    // Tracking a model implies wanting to follow it (§27).
    await prisma.watchlistItem.upsert({
      where: { userId_marketModelId: { userId, marketModelId: created.id } },
      update: {},
      create: { userId, marketModelId: created.id },
    })
  } catch (error) {
    console.error('trackModel failed', error)
    return { error: 'Model tidak dapat ditambahkan. Silakan coba lagi.' }
  }

  revalidatePath('/pasar')
  return {}
}

const idSchema = z.object({ marketModelId: z.string().min(1) })

export async function toggleWatchlist(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = idSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Model tidak valid.' }

  const model = await prisma.marketModel.findFirst({
    where: { id: parsed.data.marketModelId, userId },
  })
  if (!model) return { error: 'Model tidak ditemukan.' }

  const existing = await prisma.watchlistItem.findUnique({
    where: { userId_marketModelId: { userId, marketModelId: model.id } },
  })

  if (existing) {
    await prisma.watchlistItem.delete({ where: { id: existing.id } })
  } else {
    await prisma.watchlistItem.create({
      data: { userId, marketModelId: model.id },
    })
  }

  revalidatePath('/pasar')
  revalidatePath(`/pasar/${model.id}`)
  return {}
}

export async function untrackModel(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = idSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Model tidak valid.' }

  const model = await prisma.marketModel.findFirst({
    where: { id: parsed.data.marketModelId, userId },
  })
  if (!model) return { error: 'Model tidak ditemukan.' }

  // Cascades to observations and watchlist. This is user-created tracking
  // data, not financial history, so a hard delete is appropriate here.
  await prisma.marketModel.delete({ where: { id: model.id } })

  revalidatePath('/pasar')
  revalidatePath('/beranda')
  // The detail page for this model no longer exists, so return to the list.
  redirect('/pasar')
}

const observationSchema = z.object({
  marketModelId: z.string().min(1),
  askingPrice: amountSchema,
  observedAt: dateSchema,
  source: z.nativeEnum(AcquisitionSource),
  mileage: z.preprocess(emptyToNull, z.coerce.number().int().min(0).nullable()),
  listingAgeDays: z.preprocess(
    emptyToNull,
    z.coerce.number().int().min(0).max(3650).nullable(),
  ),
  url: z.preprocess(emptyToNull, z.string().trim().url('URL tidak valid').nullable()),
  note: z.preprocess(emptyToNull, z.string().trim().max(500).nullable()),
})

/**
 * Record a listing seen in the wild — §22's marketplace signal.
 *
 * This is the only real market data the application has, and it is what lifts a
 * model out of illustration territory.
 */
export async function addObservation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = observationSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return toActionState(parsed.error)

  const model = await prisma.marketModel.findFirst({
    where: { id: parsed.data.marketModelId, userId },
  })
  if (!model) return { error: 'Model tidak ditemukan.' }

  if (parsed.data.observedAt.getTime() > Date.now()) {
    return {
      error: 'Tanggal observasi tidak boleh di masa depan.',
      fieldErrors: { observedAt: 'Tanggal tidak boleh di masa depan' },
    }
  }

  try {
    await prisma.marketObservation.create({
      data: {
        userId,
        marketModelId: model.id,
        observedAt: parsed.data.observedAt,
        source: parsed.data.source,
        askingPrice: parsed.data.askingPrice,
        mileage: parsed.data.mileage,
        listingAgeDays: parsed.data.listingAgeDays,
        url: parsed.data.url,
        note: parsed.data.note,
      },
    })
  } catch (error) {
    console.error('addObservation failed', error)
    return {
      error:
        'Observasi tidak dapat disimpan. Data Anda tidak hilang — silakan coba lagi.',
    }
  }

  revalidatePath('/pasar')
  revalidatePath(`/pasar/${model.id}`)
  revalidatePath('/beranda')
  return {}
}

export async function deleteObservation(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const id = String(formData.get('observationId') ?? '')
  if (!id) return { error: 'Observasi tidak valid.' }

  const observation = await prisma.marketObservation.findFirst({
    where: { id, userId },
  })
  if (!observation) return { error: 'Observasi tidak ditemukan.' }

  await prisma.marketObservation.delete({ where: { id: observation.id } })

  revalidatePath(`/pasar/${observation.marketModelId}`)
  revalidatePath('/pasar')
  return {}
}
