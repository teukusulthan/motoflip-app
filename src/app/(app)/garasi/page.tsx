import Link from 'next/link'
import { Bike, Plus } from 'lucide-react'
import type { MotorcycleStatus } from '@prisma/client'
import { requireUser } from '@/server/auth'
import { getAllEntries } from '@/data/finance'
import { getMotorcycles } from '@/data/garage'
import { motorcycleFinancials, expectedOutcome } from '@/domain/costing'
import { entriesFor } from '@/domain/ledger'
import { isClosed, isInInventory } from '@/domain/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/motoflip/empty-state'
import { PageHeader } from '@/components/motoflip/page-header'
import {
  MotorcycleCard,
  type MotorcycleCardData,
} from '@/components/motoflip/motorcycle-card'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Garasi · motoflip' }
export const dynamic = 'force-dynamic'

const FILTERS = [
  { key: 'aktif', label: 'Aktif' },
  { key: 'terjual', label: 'Terjual' },
  { key: 'prospek', label: 'Prospek' },
  { key: 'semua', label: 'Semua' },
] as const

type FilterKey = (typeof FILTERS)[number]['key']

function matches(filter: FilterKey, status: MotorcycleStatus): boolean {
  if (filter === 'semua') return true
  if (filter === 'aktif') return isInInventory(status)
  if (filter === 'terjual') return isClosed(status)
  return status === 'LEAD' || status === 'PURCHASING'
}

export default async function GaragePage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const filter: FilterKey =
    FILTERS.find((f) => f.key === params.filter)?.key ?? 'aktif'

  const [motorcycles, entries] = await Promise.all([
    getMotorcycles(user.id),
    getAllEntries(user.id),
  ])

  if (motorcycles.length === 0) {
    return (
      <>
        <PageHeader title="Garasi" />
        <EmptyState
          icon={Bike}
          title="Belum ada motor."
          description="Mulai dengan menambahkan motor pertama Anda dan lacak seluruh perjalanan flipping-nya."
          actionLabel="+ Tambah Motor"
          actionHref="/garasi/baru"
        />
      </>
    )
  }

  const now = new Date()
  const visible = motorcycles.filter((m) => matches(filter, m.status))

  const cards: MotorcycleCardData[] = visible.map((bike) => {
    const own = entriesFor(bike.id, entries)
    const financials = motorcycleFinancials(own, now)
    const expected = expectedOutcome(bike, own)

    return {
      id: bike.id,
      title: [bike.brand, bike.model, bike.year].filter(Boolean).join(' '),
      subtitle: [bike.variant, `${bike.year}`].filter(Boolean).join(' · '),
      status: bike.status,
      totalCost: financials.totalCost,
      headlineLabel: financials.isSold ? 'Laba Bersih' : 'Perkiraan Laba',
      headlineValue: financials.isSold
        ? financials.netProfit
        : (expected?.expectedProfit ?? null),
      roiBps: financials.isSold
        ? financials.roi
        : (expected?.expectedRoi ?? null),
      days: financials.holdingPeriodDays,
    }
  })

  return (
    <>
      <PageHeader
        title="Garasi"
        subtitle={`${motorcycles.length} motor tercatat`}
        action={
          <Button asChild size="icon" aria-label="Tambah motor">
            <Link href="/garasi/baru">
              <Plus className="size-5" aria-hidden />
            </Link>
          </Button>
        }
      />

      {/* Segmented control — §32 */}
      <nav
        aria-label="Filter status"
        className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4"
      >
        {FILTERS.map((item) => {
          const active = item.key === filter
          const count = motorcycles.filter((m) =>
            matches(item.key, m.status),
          ).length
          return (
            <Link
              key={item.key}
              href={`/garasi?filter=${item.key}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex h-11 shrink-0 items-center gap-1.5 rounded-md border px-3.5 text-sm font-semibold transition-colors',
                active
                  ? 'border-accent/50 bg-accent/12 text-accent'
                  : 'border-border bg-surface text-fg-muted hover:text-fg',
              )}
            >
              {item.label}
              <span
                className={cn(
                  'tabular text-xs',
                  active ? 'text-accent/70' : 'text-fg-subtle',
                )}
              >
                {count}
              </span>
            </Link>
          )
        })}
      </nav>

      {cards.length === 0 ? (
        <EmptyState
          icon={Bike}
          title="Tidak ada motor di filter ini."
          description="Coba pilih filter lain, atau tambahkan motor baru ke garasi Anda."
          actionLabel="+ Tambah Motor"
          actionHref="/garasi/baru"
        />
      ) : (
        <ul className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0 xl:grid-cols-3">
          {cards.map((bike) => (
            <MotorcycleCard key={bike.id} bike={bike} />
          ))}
        </ul>
      )}
    </>
  )
}
