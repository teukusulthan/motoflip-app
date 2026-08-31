import Link from 'next/link'
import { Receipt, TrendingDown, TrendingUp, ArrowLeftRight } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getRecentEntries } from '@/data/finance'
import { formatDate, formatRupiah } from '@/lib/format'
import { Card } from '@/components/ui/card'
import { EmptyState } from '@/components/motoflip/empty-state'
import { PageHeader } from '@/components/motoflip/page-header'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Transaksi · motoflip' }
export const dynamic = 'force-dynamic'

export default async function TransactionsPage() {
  const user = await requireUser()
  const entries = await getRecentEntries(user.id, 100)

  if (entries.length === 0) {
    return (
      <>
        <PageHeader title="Transaksi" backHref="/lainnya" />
        <EmptyState
          icon={Receipt}
          title="Belum ada transaksi."
          description="Setiap pembelian, biaya perbaikan, dan penjualan akan muncul di sini sebagai catatan yang dapat diaudit."
          actionLabel="Tambah Pengeluaran"
          actionHref="/transaksi/pengeluaran"
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Transaksi"
        subtitle={`${entries.length} catatan terakhir`}
        backHref="/lainnya"
      />

      <Card>
        <ul className="divide-y divide-border">
          {entries.map((entry) => {
            const Icon =
              entry.type === 'INCOME'
                ? TrendingUp
                : entry.type === 'TRANSFER'
                  ? ArrowLeftRight
                  : TrendingDown

            return (
              <li key={entry.id} className="flex items-center gap-3 px-4 py-3">
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-md',
                    entry.type === 'INCOME'
                      ? 'bg-success-muted text-success'
                      : entry.type === 'TRANSFER'
                        ? 'bg-info-muted text-info'
                        : 'bg-elevated text-fg-muted',
                  )}
                >
                  <Icon className="size-4" aria-hidden />
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={cn(
                      'truncate text-sm font-medium',
                      entry.voidedAt ? 'text-fg-subtle line-through' : 'text-fg',
                    )}
                  >
                    {entry.note ?? entry.category.name}
                  </p>
                  <p className="truncate text-xs text-fg-subtle">
                    {formatDate(entry.occurredAt)} · {entry.category.name}
                    {entry.motorcycle
                      ? ` · ${entry.motorcycle.brand} ${entry.motorcycle.model}`
                      : ''}
                  </p>
                </div>

                {entry.motorcycle ? (
                  <Link
                    href={`/garasi/${entry.motorcycle.id}`}
                    className={cn(
                      'tabular shrink-0 text-metric-sm',
                      entry.voidedAt
                        ? 'text-fg-subtle line-through'
                        : entry.type === 'INCOME'
                          ? 'text-success'
                          : 'text-fg',
                    )}
                  >
                    {entry.type === 'INCOME' ? '+' : entry.type === 'EXPENSE' ? '−' : ''}
                    {formatRupiah(entry.amount)}
                  </Link>
                ) : (
                  <span
                    className={cn(
                      'tabular shrink-0 text-metric-sm',
                      entry.voidedAt
                        ? 'text-fg-subtle line-through'
                        : entry.type === 'INCOME'
                          ? 'text-success'
                          : 'text-fg',
                    )}
                  >
                    {entry.type === 'INCOME' ? '+' : entry.type === 'EXPENSE' ? '−' : ''}
                    {formatRupiah(entry.amount)}
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      </Card>
    </>
  )
}
