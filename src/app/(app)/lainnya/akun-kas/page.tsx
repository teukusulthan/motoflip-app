import { requireUser } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { getAllEntries } from '@/data/finance'
import { toDomainAccount } from '@/data/mappers'
import { cashAccountBalance } from '@/domain/ledger'
import { formatRupiah } from '@/lib/format'
import { PageHeader } from '@/components/motoflip/page-header'
import { AccountManager } from './manager'

export const metadata = { title: 'Akun Kas · motoflip' }
export const dynamic = 'force-dynamic'

export default async function CashAccountPage() {
  const user = await requireUser()
  const [rows, entries] = await Promise.all([
    prisma.cashAccount.findMany({
      where: { userId: user.id },
      orderBy: [{ archivedAt: 'asc' }, { sortOrder: 'asc' }, { name: 'asc' }],
    }),
    getAllEntries(user.id),
  ])

  return (
    <>
      <PageHeader
        title="Akun Kas"
        subtitle="Dompet, rekening, dan e-wallet"
        backHref="/lainnya"
      />
      <AccountManager
        accounts={rows.map((row) => ({
          id: row.id,
          name: row.name,
          kind: row.kind,
          openingBalance: row.openingBalance.toString(),
          balance: formatRupiah(cashAccountBalance(toDomainAccount(row), entries)),
          archived: row.archivedAt !== null,
        }))}
      />
    </>
  )
}
