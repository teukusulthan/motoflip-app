'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { DocumentType, PhotoCategory } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireUserId } from '@/server/auth'
import {
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
  UploadError,
  readValidatedUpload,
  removeFile,
  storeFile,
} from '@/server/storage'
import type { ActionState } from '@/lib/validation'

/** Confirm the motorcycle belongs to the signed-in user before touching it. */
async function ownedMotorcycle(userId: string, motorcycleId: string) {
  const bike = await prisma.motorcycle.findFirst({
    where: { id: motorcycleId, userId },
    select: { id: true, heroPhotoId: true },
  })
  if (!bike) throw new UploadError('Motor tidak ditemukan.')
  return bike
}

const photoSchema = z.object({
  motorcycleId: z.string().min(1),
  category: z.nativeEnum(PhotoCategory),
  caption: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === '' ? null : v)),
})

/** §12 — upload one or more photos into a motorcycle's permanent gallery. */
export async function uploadPhotos(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()

  const parsed = photoSchema.safeParse({
    motorcycleId: formData.get('motorcycleId'),
    category: formData.get('category'),
    caption: formData.get('caption') ?? '',
  })
  if (!parsed.success) return { error: 'Data foto tidak valid.' }

  const files = formData
    .getAll('files')
    .filter((entry): entry is File => entry instanceof File && entry.size > 0)

  if (files.length === 0) return { error: 'Pilih minimal satu foto.' }
  if (files.length > 12) return { error: 'Maksimal 12 foto per unggahan.' }

  try {
    const bike = await ownedMotorcycle(userId, parsed.data.motorcycleId)

    const last = await prisma.photo.findFirst({
      where: { motorcycleId: bike.id, deletedAt: null },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    let sortOrder = (last?.sortOrder ?? -1) + 1

    for (const file of files) {
      const buffer = await readValidatedUpload(
        file,
        PHOTO_MIME_TYPES,
        MAX_PHOTO_BYTES,
      )
      const stored = await storeFile(buffer, file.type, 'photos')

      const photo = await prisma.photo.create({
        data: {
          userId,
          motorcycleId: bike.id,
          publicId: stored.publicId,
          url: stored.url,
          width: stored.width,
          height: stored.height,
          category: parsed.data.category,
          caption: parsed.data.caption,
          sortOrder: sortOrder++,
        },
      })

      // First photo ever uploaded becomes the hero automatically.
      if (!bike.heroPhotoId) {
        await prisma.motorcycle.update({
          where: { id: bike.id },
          data: { heroPhotoId: photo.id },
        })
        bike.heroPhotoId = photo.id
      }
    }
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message }
    console.error('uploadPhotos failed', error)
    return { error: 'Foto tidak dapat diunggah. Silakan coba lagi.' }
  }

  revalidatePath(`/garasi/${parsed.data.motorcycleId}`)
  return {}
}

const photoIdSchema = z.object({
  photoId: z.string().min(1),
  motorcycleId: z.string().min(1),
})

export async function setHeroPhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = photoIdSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Foto tidak valid.' }

  const photo = await prisma.photo.findFirst({
    where: {
      id: parsed.data.photoId,
      userId,
      motorcycleId: parsed.data.motorcycleId,
      deletedAt: null,
    },
  })
  if (!photo) return { error: 'Foto tidak ditemukan.' }

  await prisma.motorcycle.update({
    where: { id: photo.motorcycleId },
    data: { heroPhotoId: photo.id },
  })

  revalidatePath(`/garasi/${photo.motorcycleId}`)
  return {}
}

/**
 * §38 — photos are soft-deleted so the gallery history of a sold motorcycle is
 * never destroyed by a mis-tap. The stored file is removed only for local dev
 * uploads; Cloudinary assets are left in place for recovery.
 */
export async function deletePhoto(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const parsed = photoIdSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { error: 'Foto tidak valid.' }

  const photo = await prisma.photo.findFirst({
    where: { id: parsed.data.photoId, userId, deletedAt: null },
  })
  if (!photo) return { error: 'Foto tidak ditemukan.' }

  await prisma.photo.update({
    where: { id: photo.id },
    data: { deletedAt: new Date() },
  })

  // Promote the next remaining photo if the hero was the one removed.
  const bike = await prisma.motorcycle.findFirst({
    where: { id: photo.motorcycleId, userId },
    select: { id: true, heroPhotoId: true },
  })
  if (bike?.heroPhotoId === photo.id) {
    const next = await prisma.photo.findFirst({
      where: { motorcycleId: bike.id, deletedAt: null },
      orderBy: { sortOrder: 'asc' },
      select: { id: true },
    })
    await prisma.motorcycle.update({
      where: { id: bike.id },
      data: { heroPhotoId: next?.id ?? null },
    })
  }

  revalidatePath(`/garasi/${photo.motorcycleId}`)
  return {}
}

const documentSchema = z.object({
  motorcycleId: z.string().min(1),
  type: z.nativeEnum(DocumentType),
  expiresAt: z
    .string()
    .transform((v) => (v.trim() === '' ? null : v))
    .refine((v) => v === null || /^\d{4}-\d{2}-\d{2}$/.test(v), {
      message: 'Tanggal tidak valid',
    })
    .transform((v) => (v === null ? null : new Date(`${v}T00:00:00.000Z`))),
  notes: z
    .string()
    .trim()
    .max(500)
    .transform((v) => (v === '' ? null : v)),
})

/** §14 — documents stay attached to the motorcycle, including after sale. */
export async function uploadDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()

  const parsed = documentSchema.safeParse({
    motorcycleId: formData.get('motorcycleId'),
    type: formData.get('type'),
    expiresAt: formData.get('expiresAt') ?? '',
    notes: formData.get('notes') ?? '',
  })
  if (!parsed.success) return { error: 'Data dokumen tidak valid.' }

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Pilih berkas dokumen.' }
  }

  try {
    const bike = await ownedMotorcycle(userId, parsed.data.motorcycleId)
    const buffer = await readValidatedUpload(
      file,
      DOCUMENT_MIME_TYPES,
      MAX_DOCUMENT_BYTES,
    )
    const stored = await storeFile(buffer, file.type, 'documents')

    await prisma.document.create({
      data: {
        userId,
        motorcycleId: bike.id,
        type: parsed.data.type,
        publicId: stored.publicId,
        url: stored.url,
        fileName: file.name.slice(0, 200),
        mimeType: file.type,
        sizeBytes: stored.bytes,
        expiresAt: parsed.data.expiresAt,
        notes: parsed.data.notes,
      },
    })
  } catch (error) {
    if (error instanceof UploadError) return { error: error.message }
    console.error('uploadDocument failed', error)
    return { error: 'Dokumen tidak dapat diunggah. Silakan coba lagi.' }
  }

  revalidatePath(`/garasi/${parsed.data.motorcycleId}`)
  revalidatePath('/beranda')
  return {}
}

export async function deleteDocument(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const userId = await requireUserId()
  const documentId = String(formData.get('documentId') ?? '')
  if (!documentId) return { error: 'Dokumen tidak valid.' }

  const document = await prisma.document.findFirst({
    where: { id: documentId, userId, deletedAt: null },
  })
  if (!document) return { error: 'Dokumen tidak ditemukan.' }

  await prisma.document.update({
    where: { id: document.id },
    data: { deletedAt: new Date() },
  })
  if (document.publicId.startsWith('local:')) {
    await removeFile(document.publicId)
  }

  revalidatePath(`/garasi/${document.motorcycleId}`)
  revalidatePath('/beranda')
  return {}
}
