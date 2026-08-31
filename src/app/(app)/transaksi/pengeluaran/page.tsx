import { requireUser } from '@/server/auth'
import { createExpense } from '@/app/actions/ledger'
import {
  getCashAccounts,
  getCategories,
  getVendors,
} from '@/data/finance'
import { getMotorcycles } from '@/data/garage'
import { isClosed } from '@/domain/types'
import { PageHeader } from '@/components/motorflip/page-header'
import { EntryForm } from '@/components/motorflip/entry-form'

export const metadata = { title: 'Tambah Pengeluaran · MotorFlip' }
export const dynamic = 'force-dynamic'

const GROUP_LABELS: Record<string, string> = {
  ACQUISITION: 'Akuisisi',
  REPAIR: 'Perbaikan',
  MAINTENANCE: 'Perawatan',
  DOCUMENTATION: 'Dokumen',
  LOGISTICS: 'Logistik',
  SELLING: 'Penjualan',
  OTHER: 'Lainnya',
}

export default async function AddExpensePage({
  searchParams,
}: {
  searchParams: Promise<{ motor?: string }>
}) {
  const user = await requireUser()
  const { motor } = await searchParams

  const [categories, motorcycles, accounts, vendors] = await Promise.all([
    getCategories(user.id),
    getMotorcycles(user.id),
    getCashAccounts(user.id),
    getVendors(user.id),
  ])

  return (
    <>
      <PageHeader title="Tambah Pengeluaran" backHref="/beranda" />
      <EntryForm
        action={createExpense}
        submitLabel="Simpan Pengeluaran"
        successMessage="Pengeluaran tersimpan."
        redirectTo={motor ? `/garasi/${motor}` : '/beranda'}
        defaultMotorcycleId={motor}
        categories={categories
          // Purchase and sale are written by their own flows (§5 lifecycle).
          .filter((c) => c.kind === 'EXPENSE' && c.role === 'NORMAL')
          .map((c) => ({
            id: c.id,
            label: c.name,
            group: GROUP_LABELS[c.group] ?? c.group,
          }))}
        motorcycles={motorcycles
          .filter((m) => !isClosed(m.status))
          .map((m) => ({
            id: m.id,
            label: `${m.brand} ${m.model} ${m.year}`,
          }))}
        accounts={accounts.map((a) => ({ id: a.id, label: a.name }))}
        vendors={vendors.map((v) => ({ id: v.id, label: v.name }))}
      />
    </>
  )
}
