import 'server-only'
import { prisma } from '@/lib/prisma'
import { LEDGER_INCLUDE, toDomainAccount, toDomainEntry } from './mappers'

/** Every ledger entry for a user. The dataset is small by design (§G risk 1). */
export async function getAllEntries(userId: string) {
  const rows = await prisma.ledgerEntry.findMany({
    where: { userId },
    include: LEDGER_INCLUDE,
    orderBy: { occurredAt: 'desc' },
  })
  return rows.map(toDomainEntry)
}

export async function getEntriesForMotorcycle(
  userId: string,
  motorcycleId: string,
) {
  const rows = await prisma.ledgerEntry.findMany({
    where: { userId, motorcycleId },
    include: LEDGER_INCLUDE,
    orderBy: { occurredAt: 'asc' },
  })
  return rows.map(toDomainEntry)
}

export async function getCashAccounts(userId: string) {
  const rows = await prisma.cashAccount.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  return rows.map(toDomainAccount)
}

export async function getCategories(userId: string) {
  return prisma.category.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ kind: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
  })
}

export async function getVendors(userId: string) {
  return prisma.vendor.findMany({
    where: { userId, archivedAt: null },
    orderBy: { name: 'asc' },
  })
}

/** Recent entries with everything the transaction list needs to render. */
export async function getRecentEntries(userId: string, take = 30) {
  return prisma.ledgerEntry.findMany({
    where: { userId },
    include: {
      category: true,
      motorcycle: { select: { id: true, brand: true, model: true, year: true } },
      vendor: { select: { id: true, name: true } },
      account: { select: { id: true, name: true } },
      toAccount: { select: { id: true, name: true } },
    },
    orderBy: [{ occurredAt: 'desc' }, { createdAt: 'desc' }],
    take,
  })
}

export async function getCategoryByRole(userId: string, role: 'PURCHASE' | 'SALE') {
  const category = await prisma.category.findFirst({ where: { userId, role } })
  if (!category) {
    throw new Error(
      `Kategori sistem dengan peran ${role} tidak ditemukan. Jalankan "npm run db:seed".`,
    )
  }
  return category
}

export async function getDefaultAccount(userId: string) {
  const account = await prisma.cashAccount.findFirst({
    where: { userId, archivedAt: null },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  })
  if (!account) {
    throw new Error('Belum ada akun kas. Tambahkan akun kas terlebih dahulu.')
  }
  return account
}
