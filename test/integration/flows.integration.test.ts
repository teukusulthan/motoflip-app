/**
 * Integration checks against a live database.
 *
 * Excluded from the default `npm test` run because it needs Postgres; run with
 * `npm run test:integration`.
 *
 * Transfers and voids are financial-correctness features whose whole point is
 * what they DO NOT change, so they are verified by asserting invariants before
 * and after, against real rows, then rolling back.
 */
import { PrismaClient } from '@prisma/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { toDomainAccount, toDomainEntry, toDomainMotorcycle } from '@/data/mappers'
import {
  availableCash,
  businessSummary,
  cashAccountBalance,
  entriesFor,
} from '@/domain/ledger'
import { totalCost } from '@/domain/costing'

const prisma = new PrismaClient()
const LEDGER_INCLUDE = { category: { select: { group: true, role: true } } } as const

let userId: string
let accountIds: string[]

async function load() {
  const [accounts, entries, bikes] = await Promise.all([
    prisma.cashAccount.findMany({ where: { userId, archivedAt: null } }),
    prisma.ledgerEntry.findMany({ where: { userId }, include: LEDGER_INCLUDE }),
    prisma.motorcycle.findMany({ where: { userId } }),
  ])
  return {
    accounts: accounts.map(toDomainAccount),
    entries: entries.map(toDomainEntry),
    bikes: bikes.map(toDomainMotorcycle),
  }
}

beforeAll(async () => {
  const user = await prisma.user.findFirstOrThrow()
  userId = user.id
  const accounts = await prisma.cashAccount.findMany({
    where: { userId, archivedAt: null },
    orderBy: { sortOrder: 'asc' },
  })
  accountIds = accounts.map((a) => a.id)
  expect(accountIds.length).toBeGreaterThanOrEqual(2)
})

afterAll(async () => {
  await prisma.$disconnect()
})

describe('transfer (§15)', () => {
  it('moves money between accounts without touching profit or assets', async () => {
    const before = await load()
    const summaryBefore = businessSummary(before.accounts, before.bikes, before.entries)
    const other = await prisma.category.findFirstOrThrow({
      where: { userId, slug: 'lainnya' },
    })

    const transfer = await prisma.ledgerEntry.create({
      data: {
        userId,
        type: 'TRANSFER',
        amount: 5_000_000n,
        occurredAt: new Date(),
        accountId: accountIds[0] as string,
        toAccountId: accountIds[1] as string,
        categoryId: other.id,
        note: 'integration transfer',
      },
    })

    try {
      const after = await load()
      const summaryAfter = businessSummary(after.accounts, after.bikes, after.entries)

      expect(availableCash(after.accounts, after.entries)).toBe(
        availableCash(before.accounts, before.entries),
      )
      expect(summaryAfter.realizedProfit).toBe(summaryBefore.realizedProfit)
      expect(summaryAfter.inventoryCapital).toBe(summaryBefore.inventoryCapital)
      expect(summaryAfter.totalAssets).toBe(summaryBefore.totalAssets)

      const src = after.accounts.find((a) => a.id === accountIds[0])
      const dst = after.accounts.find((a) => a.id === accountIds[1])
      expect(src).toBeDefined()
      expect(dst).toBeDefined()

      expect(
        cashAccountBalance(src!, before.entries) -
          cashAccountBalance(src!, after.entries),
      ).toBe(5_000_000n)
      expect(
        cashAccountBalance(dst!, after.entries) -
          cashAccountBalance(dst!, before.entries),
      ).toBe(5_000_000n)
    } finally {
      await prisma.ledgerEntry.delete({ where: { id: transfer.id } })
    }
  })
})

describe('void (§38)', () => {
  it('removes an entry from calculations while retaining it for audit', async () => {
    const bike = await prisma.motorcycle.findFirstOrThrow({
      where: { userId, status: 'SOLD' },
    })
    const repair = await prisma.category.findFirstOrThrow({
      where: { userId, slug: 'cvt' },
    })

    const costBefore = totalCost(entriesFor(bike.id, (await load()).entries))

    const extra = await prisma.ledgerEntry.create({
      data: {
        userId,
        type: 'EXPENSE',
        amount: 777_000n,
        occurredAt: new Date(),
        accountId: accountIds[0] as string,
        motorcycleId: bike.id,
        categoryId: repair.id,
        note: 'integration expense',
      },
    })

    try {
      const withExtra = totalCost(entriesFor(bike.id, (await load()).entries))
      expect(withExtra - costBefore).toBe(777_000n)

      await prisma.ledgerEntry.update({
        where: { id: extra.id },
        data: { voidedAt: new Date(), voidReason: 'integration' },
      })

      const afterVoid = totalCost(entriesFor(bike.id, (await load()).entries))
      expect(afterVoid).toBe(costBefore)

      const retained = await prisma.ledgerEntry.findUnique({
        where: { id: extra.id },
      })
      expect(retained).not.toBeNull()
      expect(retained?.voidReason).toBe('integration')
    } finally {
      await prisma.ledgerEntry.delete({ where: { id: extra.id } })
    }
  })
})
