import { requireUser } from '@/server/auth'
import { getAllEntries, getCashAccounts } from '@/data/finance'
import { cashAccountBalance } from '@/domain/ledger'
import { formatRupiah } from '@/lib/format'
import { PageHeader } from '@/components/motoflip/page-header'
import { TransferForm } from './form'

export const metadata = { title: 'Transfer Antar Akun · motoflip' }
export const dynamic = 'force-dynamic'

export default async function TransferPage() {
  const user = await requireUser()
  const [accounts, entries] = await Promise.all([
    getCashAccounts(user.id),
    getAllEntries(user.id),
  ])

  return (
    <>
      <PageHeader
        title="Transfer Antar Akun"
        subtitle="Memindahkan uang tanpa memengaruhi laba"
        backHref="/lainnya"
      />
      <TransferForm
        accounts={accounts.map((account) => ({
          id: account.id,
          label: `${account.name} · ${formatRupiah(cashAccountBalance(account, entries))}`,
        }))}
      />
    </>
  )
}
