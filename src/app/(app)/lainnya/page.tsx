import Link from 'next/link'
import {
  ArrowLeftRight,
  BarChart3,
  Calculator,
  ChevronRight,
  History,
  LogOut,
  Receipt,
  Settings,
  Store,
  Tags,
  Users,
  Wallet,
} from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getAllEntries, getCashAccounts } from '@/data/finance'
import { cashAccountBalance } from '@/domain/ledger'
import { formatRupiah } from '@/lib/format'
import { signOut } from '@/app/actions/auth'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { PageHeader, SectionHeader } from '@/components/motoflip/page-header'
import { StatRow } from '@/components/motoflip/stat'

export const metadata = { title: 'Lainnya · motoflip' }
export const dynamic = 'force-dynamic'

const SECTIONS = [
  {
    title: 'Analisis',
    links: [
      { href: '/analitik', label: 'Analitik', hint: 'Kinerja, ROI, umur inventori', icon: BarChart3 },
      { href: '/analisa-deal', label: 'Analisa Deal', hint: 'Hitung proyeksi sebelum membeli', icon: Calculator },
      { href: '/lainnya/analisa', label: 'Riwayat Analisa', hint: 'Deal yang pernah Anda hitung', icon: History },
      { href: '/pasar', label: 'Pasar', hint: 'Tren model dan skor peluang', icon: Store },
    ],
  },
  {
    title: 'Keuangan',
    links: [
      { href: '/transaksi', label: 'Transaksi', hint: 'Semua pemasukan dan pengeluaran', icon: Receipt },
      { href: '/transaksi/transfer', label: 'Transfer Antar Akun', hint: 'Pindahkan uang tanpa memengaruhi laba', icon: ArrowLeftRight },
      { href: '/lainnya/akun-kas', label: 'Akun Kas', hint: 'Dompet, rekening, e-wallet', icon: Wallet },
    ],
  },
  {
    title: 'Data Master',
    links: [
      { href: '/lainnya/vendor', label: 'Vendor', hint: 'Bengkel, biro jasa, pemasok', icon: Users },
      { href: '/lainnya/kategori', label: 'Kategori', hint: 'Klasifikasi pemasukan & pengeluaran', icon: Tags },
      { href: '/lainnya/pengaturan', label: 'Pengaturan', hint: 'Ambang peringatan di beranda', icon: Settings },
    ],
  },
] as const

export default async function MorePage() {
  const user = await requireUser()
  const [accounts, entries] = await Promise.all([
    getCashAccounts(user.id),
    getAllEntries(user.id),
  ])

  return (
    <>
      <PageHeader title="Lainnya" subtitle={user.email} />

      {SECTIONS.map((section) => (
        <nav key={section.title} aria-label={section.title} className="mb-6">
          <SectionHeader title={section.title} />
          <ul className="space-y-2">
            {section.links.map((link) => (
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
      ))}

      <section>
        <SectionHeader title="Saldo Akun" />
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

      <form action={signOut} className="mt-8">
        <Button type="submit" variant="secondary" size="full">
          <LogOut className="size-4" aria-hidden />
          Keluar
        </Button>
      </form>
    </>
  )
}
