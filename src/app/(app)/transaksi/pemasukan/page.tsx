import { requireUser } from '@/server/auth'
import { createIncome } from '@/app/actions/ledger'
import { getCashAccounts, getCategories, getVendors } from '@/data/finance'
import { getMotorcycles } from '@/data/garage'
import { PageHeader } from '@/components/motoflip/page-header'
import { EntryForm } from '@/components/motoflip/entry-form'
import { Card, CardContent } from '@/components/ui/card'
import { Info } from 'lucide-react'

export const metadata = { title: 'Tambah Pemasukan · motoflip' }
export const dynamic = 'force-dynamic'

export default async function AddIncomePage() {
  const user = await requireUser()

  const [categories, motorcycles, accounts, vendors] = await Promise.all([
    getCategories(user.id),
    getMotorcycles(user.id),
    getCashAccounts(user.id),
    getVendors(user.id),
  ])

  return (
    <>
      <PageHeader title="Tambah Pemasukan" backHref="/beranda" />

      <Card className="mb-4 border-dashed">
        <CardContent className="flex items-start gap-3 py-3">
          <Info className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
          <p className="text-xs leading-relaxed text-fg-muted">
            Untuk mencatat penjualan motor, gunakan tombol{' '}
            <span className="font-semibold text-fg">Tandai Terjual</span> di
            halaman motor — status, laba, dan ROI ikut diperbarui otomatis.
          </p>
        </CardContent>
      </Card>

      <EntryForm
        action={createIncome}
        submitLabel="Simpan Pemasukan"
        successMessage="Pemasukan tersimpan."
        redirectTo="/beranda"
        categories={categories
          .filter((c) => c.kind === 'INCOME' && c.role === 'NORMAL')
          .map((c) => ({ id: c.id, label: c.name, group: 'Pemasukan' }))}
        motorcycles={motorcycles.map((m) => ({
          id: m.id,
          label: `${m.brand} ${m.model} ${m.year}`,
        }))}
        accounts={accounts.map((a) => ({ id: a.id, label: a.name }))}
        vendors={vendors.map((v) => ({ id: v.id, label: v.name }))}
      />
    </>
  )
}
