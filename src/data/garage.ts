import 'server-only'
import { prisma } from '@/lib/prisma'
import { toDomainMotorcycle } from './mappers'

export async function getMotorcycles(userId: string) {
  const rows = await prisma.motorcycle.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
  return rows.map(toDomainMotorcycle)
}

export async function getMotorcycleRows(userId: string) {
  return prisma.motorcycle.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  })
}

/** A single motorcycle, scoped to the owner — never trust an id alone (§45). */
export async function getMotorcycle(userId: string, id: string) {
  return prisma.motorcycle.findFirst({ where: { id, userId } })
}

export async function getPhotos(userId: string, motorcycleId: string) {
  return prisma.photo.findMany({
    where: { userId, motorcycleId, deletedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
}

export async function getDocuments(userId: string, motorcycleId: string) {
  return prisma.document.findMany({
    where: { userId, motorcycleId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
  })
}

export async function getStatusChanges(userId: string, motorcycleId: string) {
  return prisma.statusChange.findMany({
    where: { userId, motorcycleId },
    orderBy: { occurredAt: 'asc' },
  })
}

/** Documents with an expiry date, for the §4 attention rules. */
export async function getExpiringDocuments(userId: string) {
  const rows = await prisma.document.findMany({
    where: { userId, deletedAt: null, expiresAt: { not: null } },
    select: { id: true, motorcycleId: true, type: true, expiresAt: true },
  })

  return rows.map((row) => ({
    id: row.id,
    motorcycleId: row.motorcycleId,
    label: row.type,
    expiresAt: row.expiresAt as Date,
  }))
}

export async function getSettings(userId: string) {
  return prisma.settings.findUnique({ where: { userId } })
}
