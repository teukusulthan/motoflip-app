import Link from 'next/link'
import {
  BarChart3,
  Calculator,
  ChevronRight,
  LogOut,
  Receipt,
  Store,
} from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getAllEntries, getCashAccounts, getVendors } from '@/data/finance'
import { cashAccountBalance } from '@/domain/ledger'
import { formatRupiah } from '@/lib/format'
import { signOut } from '@/app/actions/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader, SectionHeader } from '@/components/motoflip/page-header'
import { StatRow } from '@/components/motoflip/stat'

export const metadata = { title: 'Lainnya · motoflip' }
export const dynamic = 'force-dynamic'

const LINKS = [
  { href: '/analitik', label: 'Analitik', hint: 'Kinerja, ROI, umur inventori', icon: BarChart3 },
  { href: '/analisa-deal', label: 'Analisa Deal', hint: 'Hitung proyeksi sebelum membeli', icon: Calculator },
  { href: '/transaksi', label: 'Transaksi', hint: 'Semua pemasukan dan pengeluaran', icon: Receipt },
  { href: '/pasar', label: 'Pasar', hint: 'Intelijen pasar (belum aktif)', icon: Store },
] as const

export default async function MorePage() {
  const user = await requireUser()
  const [accounts, entries, vendors] = await Promise.all([
    getCashAccounts(user.id),
    getAllEntries(user.id),
    getVendors(user.id),
  ])

  return (
    <>
      <PageHeader title="Lainnya" subtitle={user.email} />

      <nav aria-label="Menu lainnya">
        <ul className="space-y-2">
          {LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className="flex min-h-tap items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-elevated text-fg-muted">
                  <link.icon className="size-4" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-fg">
                    {link.label}
                  </span>
                  <span className="block truncate text-xs text-fg-muted">
                    {link.hint}
                  </span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-fg-subtle" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <section className="mt-6">
        <SectionHeader title="Akun Kas" />
        <Card>
          <CardContent className="py-1">
            {accounts.map((account) => (
              <StatRow
                key={account.id}
                label={account.name}
                value={formatRupiah(cashAccountBalance(account, entries))}
              />
            ))}
          </CardContent>
        </Card>
      </section>

      <section className="mt-6">
        <SectionHeader title="Vendor" />
        <Card>
          <CardContent className="py-1">
            {vendors.length === 0 ? (
              <p className="py-3 text-sm text-fg-muted">Belum ada vendor.</p>
            ) : (
              vendors.map((vendor) => (
                <StatRow
                  key={vendor.id}
                  label={vendor.name}
                  value={vendor.category ?? '—'}
                />
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <form action={signOut} className="mt-8">
        <Button type="submit" variant="secondary" size="full">
          <LogOut className="size-4" aria-hidden />
          Keluar
        </Button>
      </form>
    </>
  )
}
