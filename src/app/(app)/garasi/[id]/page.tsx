import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Bike, Plus } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getCashAccounts, getEntriesForMotorcycle } from '@/data/finance'
import {
  getDocuments,
  getMotorcycle,
  getPhotos,
  getStatusChanges,
} from '@/data/garage'
import { expectedOutcome, motorcycleFinancials } from '@/domain/costing'
import { varianceReport } from '@/domain/variance'
import { toDomainMotorcycle } from '@/data/mappers'
import { isClosed } from '@/domain/types'
import {
  formatDate,
  formatPercent,
  formatRupiah,
  formatRupiahSigned,
} from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { PageHeader, SectionHeader } from '@/components/motoflip/page-header'
import { StatusBadge, STATUS_LABELS } from '@/components/motoflip/status-badge'
import { Stat, StatRow } from '@/components/motoflip/stat'
import { Timeline, type TimelineEvent } from '@/components/motoflip/timeline'
import { StatusControl } from './status-control'
import { SellPanel } from './sell-panel'
import { Gallery } from './gallery'
import { Documents } from './documents'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const TABS = [
  { key: 'finansial', label: 'Finansial' },
  { key: 'galeri', label: 'Galeri' },
  { key: 'linimasa', label: 'Linimasa' },
  { key: 'dokumen', label: 'Dokumen' },
] as const

const GROUP_LABELS: Record<string, string> = {
  ACQUISITION: 'Akuisisi',
  REPAIR: 'Perbaikan',
  MAINTENANCE: 'Perawatan',
  DOCUMENTATION: 'Dokumen',
  LOGISTICS: 'Logistik',
  SELLING: 'Penjualan',
  OTHER: 'Lainnya',
  SALE: 'Penjualan',
  OTHER_INCOME: 'Pendapatan Lain',
}

export default async function MotorcycleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const user = await requireUser()
  const { id } = await params
  const { tab: tabParam } = await searchParams
  const tab = TABS.find((t) => t.key === tabParam)?.key ?? 'finansial'

  const row = await getMotorcycle(user.id, id)
  if (!row) notFound()

  const [rawEntries, photos, documents, statusChanges, accounts] =
    await Promise.all([
      getEntriesForMotorcycle(user.id, row.id),
      getPhotos(user.id, row.id),
      getDocuments(user.id, row.id),
      getStatusChanges(user.id, row.id),
      getCashAccounts(user.id),
    ])

  const bike = toDomainMotorcycle(row)
  const entries = rawEntries
  const now = new Date()
  const financials = motorcycleFinancials(entries, now)
  const expected = expectedOutcome(bike, entries)
  const variance = varianceReport(bike, entries, now)
  const sold = isClosed(bike.status)

  const title = [row.brand, row.model, row.year].filter(Boolean).join(' ')
  const hero = photos.find((p) => p.id === row.heroPhotoId) ?? photos[0]

  return (
    <>
      <PageHeader
        title={title}
        subtitle={[row.variant, row.color, row.plateNumber]
          .filter(Boolean)
          .join(' · ')}
        backHref="/garasi"
      />

      {/* Hero */}
      <div className="relative mb-4 aspect-[4/3] w-full overflow-hidden rounded-lg border border-border bg-elevated">
        {hero ? (
          <Image
            src={hero.url}
            alt={hero.caption ?? title}
            fill
            sizes="(max-width: 1024px) 100vw, 520px"
            className="object-cover"
            priority
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-fg-subtle">
            <Bike className="size-8" aria-hidden />
            <p className="text-xs">Belum ada foto</p>
          </div>
        )}
        <div className="absolute left-3 top-3 flex gap-2">
          <StatusBadge status={row.status} />
          {financials.holdingPeriodDays !== null && (
            <Badge tone="neutral">{financials.holdingPeriodDays} hari</Badge>
          )}
        </div>
      </div>

      {/* Headline financials — §7 */}
      <Card>
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="p-4">
            <Stat
              label="Total Biaya"
              value={formatRupiah(financials.totalCost)}
              size="md"
            />
          </div>
          <div className="p-4">
            <Stat
              label={sold ? 'Laba Bersih' : 'Perkiraan Laba'}
              value={formatRupiah(
                sold ? financials.netProfit : (expected?.expectedProfit ?? null),
              )}
              hint={formatPercent(
                sold ? financials.roi : (expected?.expectedRoi ?? null),
              )}
              size="md"
              tone={
                (sold ? financials.netProfit : (expected?.expectedProfit ?? 0n)) >= 0n
                  ? 'positive'
                  : 'negative'
              }
            />
          </div>
        </div>
        <CardContent className="py-1">
          <StatRow
            label="Harga Beli"
            value={formatRupiah(financials.purchasePrice)}
          />
          <StatRow
            label="Biaya Tambahan"
            value={formatRupiah(financials.additionalCosts)}
          />
          {sold ? (
            <StatRow
              label="Harga Jual"
              value={formatRupiah(financials.salePrice)}
              tone="positive"
            />
          ) : (
            <StatRow
              label="Target Jual"
              value={formatRupiah(row.targetSellingPrice)}
              tone="accent"
            />
          )}
        </CardContent>
      </Card>

      {/* Primary actions stay above the fold — §7 */}
      <div className="mt-3 grid grid-cols-2 gap-3">
        <Button asChild variant="secondary">
          <Link href={`/transaksi/pengeluaran?motor=${row.id}`}>
            <Plus className="size-4" aria-hidden />
            Pengeluaran
          </Link>
        </Button>
        {sold ? (
          <Button variant="secondary" disabled>
            Terjual
          </Button>
        ) : (
          <SellPanel
            motorcycleId={row.id}
            accounts={accounts.map((a) => ({ id: a.id, name: a.name }))}
            suggestedPrice={row.targetSellingPrice?.toString() ?? ''}
          />
        )}
      </div>

      <div className="mt-3">
        <StatusControl motorcycleId={row.id} current={row.status} />
      </div>

      {/* Tabs */}
      <nav
        aria-label="Bagian detail"
        className="no-scrollbar -mx-4 mt-6 flex gap-1 overflow-x-auto border-b border-border px-4"
      >
        {TABS.map((item) => {
          const active = item.key === tab
          return (
            <Link
              key={item.key}
              href={`/garasi/${row.id}?tab=${item.key}`}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'relative flex h-11 shrink-0 items-center px-3 text-sm font-semibold transition-colors',
                active
                  ? 'text-accent after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:rounded-full after:bg-accent'
                  : 'text-fg-muted hover:text-fg',
              )}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="pt-5">
        {tab === 'finansial' && (
          <FinancialTab
            financials={financials}
            variance={variance}
            sold={sold}
            entries={rawEntries}
          />
        )}
        {tab === 'galeri' && (
          <Gallery
            motorcycleId={row.id}
            title={title}
            photos={photos.map((photo) => ({
              id: photo.id,
              url: photo.url,
              caption: photo.caption,
              category: photo.category,
              isHero: photo.id === row.heroPhotoId,
            }))}
          />
        )}
        {tab === 'linimasa' && (
          <Timeline
            events={buildTimeline(rawEntries, statusChanges, photos, documents)}
          />
        )}
        {tab === 'dokumen' && (
          <Documents
            motorcycleId={row.id}
            documents={documents.map((doc) => ({
              id: doc.id,
              type: doc.type,
              url: doc.url,
              fileName: doc.fileName,
              sizeBytes: doc.sizeBytes,
              expiresAt: doc.expiresAt?.toISOString() ?? null,
              notes: doc.notes,
            }))}
          />
        )}
      </div>
    </>
  )
}

function FinancialTab({
  financials,
  variance,
  sold,
  entries,
}: {
  financials: ReturnType<typeof motorcycleFinancials>
  variance: ReturnType<typeof varianceReport>
  sold: boolean
  entries: Awaited<ReturnType<typeof getEntriesForMotorcycle>>
}) {
  const breakdown = Object.entries(financials.breakdown).filter(
    ([, value]) => value > 0n,
  )

  return (
    <div className="space-y-6">
      <section>
        <SectionHeader title="Rincian Biaya" />
        <Card>
          <CardContent className="py-1">
            {breakdown.length === 0 ? (
              <p className="py-3 text-sm text-fg-muted">
                Belum ada biaya tercatat.
              </p>
            ) : (
              <>
                {breakdown.map(([group, value]) => (
                  <StatRow
                    key={group}
                    label={GROUP_LABELS[group] ?? group}
                    value={formatRupiah(value)}
                  />
                ))}
                <StatRow
                  label="Total Biaya"
                  value={formatRupiah(financials.totalCost)}
                  emphasis
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* §9 — projected vs actual */}
      <section>
        <SectionHeader title="Proyeksi vs Realisasi" />
        <Card>
          <CardContent className="space-y-4">
            <VarianceRow label="Harga Beli" line={variance.purchase} />
            <VarianceRow label="Total Biaya" line={variance.cost} />
            <VarianceRow label="Harga Jual" line={variance.sale} />
            <VarianceRow label="Laba" line={variance.profit} />

            <div className="flex items-center justify-between border-t border-border pt-3">
              <span className="text-sm text-fg-muted">ROI</span>
              <span className="tabular text-sm text-fg">
                {formatPercent(variance.projectedRoi)}
                <span className="mx-1.5 text-fg-subtle">→</span>
                <span
                  className={
                    variance.actualRoi === null
                      ? 'text-fg-subtle'
                      : variance.actualRoi >= (variance.projectedRoi ?? 0)
                        ? 'text-success'
                        : 'text-danger'
                  }
                >
                  {formatPercent(variance.actualRoi)}
                </span>
              </span>
            </div>
          </CardContent>
        </Card>
      </section>

      {sold && (
        <section>
          <SectionHeader title="Kinerja" />
          <Card>
            <CardContent className="py-1">
              <StatRow
                label="Lama Simpan"
                value={
                  financials.holdingPeriodDays === null
                    ? '—'
                    : `${financials.holdingPeriodDays} hari`
                }
              />
              <StatRow
                label="Laba per Hari"
                value={formatRupiah(financials.profitPerDay)}
                tone={
                  (financials.profitPerDay ?? 0n) >= 0n ? 'positive' : 'negative'
                }
              />
              <StatRow
                label="Tanggal Beli"
                value={formatDate(financials.purchaseDate)}
              />
              <StatRow
                label="Tanggal Jual"
                value={formatDate(financials.saleDate)}
              />
            </CardContent>
          </Card>
        </section>
      )}

      <section>
        <SectionHeader title="Transaksi" />
        {entries.length === 0 ? (
          <p className="py-6 text-center text-sm text-fg-muted">
            Belum ada transaksi.
          </p>
        ) : (
          <Card>
            <ul className="divide-y divide-border">
              {[...entries].reverse().map((entry) => (
                <li
                  key={entry.id}
                  className="flex items-start justify-between gap-3 px-4 py-3"
                >
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'truncate text-sm font-medium',
                        entry.voidedAt ? 'text-fg-subtle line-through' : 'text-fg',
                      )}
                    >
                      {entry.note ?? GROUP_LABELS[entry.categoryGroup] ?? '—'}
                    </p>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {formatDate(entry.occurredAt)}
                    </p>
                  </div>
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
                    {entry.type === 'INCOME' ? '+' : '−'}
                    {formatRupiah(entry.amount)}
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </div>
  )
}

function VarianceRow({
  label,
  line,
}: {
  label: string
  line: ReturnType<typeof varianceReport>['purchase']
}) {
  const toneClass =
    line.direction === 'better'
      ? 'text-success'
      : line.direction === 'worse'
        ? 'text-danger'
        : 'text-fg-muted'

  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm text-fg-muted">{label}</span>
        <span className="tabular text-sm text-fg">
          {formatRupiah(line.projected)}
          <span className="mx-1.5 text-fg-subtle">→</span>
          {formatRupiah(line.actual)}
        </span>
      </div>
      {line.delta !== null && line.delta !== 0n && (
        <p className={cn('tabular mt-0.5 text-right text-xs', toneClass)}>
          {formatRupiahSigned(line.delta)}
        </p>
      )}
    </div>
  )
}

/** §13 — merge every real event into one chronological stream. */
function buildTimeline(
  entries: Awaited<ReturnType<typeof getEntriesForMotorcycle>>,
  statusChanges: Awaited<ReturnType<typeof getStatusChanges>>,
  photos: Awaited<ReturnType<typeof getPhotos>>,
  documents: Awaited<ReturnType<typeof getDocuments>>,
): TimelineEvent[] {
  const events: TimelineEvent[] = []

  for (const entry of entries) {
    events.push({
      id: `entry-${entry.id}`,
      date: entry.occurredAt,
      kind:
        entry.categoryRole === 'PURCHASE'
          ? 'PURCHASE'
          : entry.categoryRole === 'SALE'
            ? 'SALE'
            : 'EXPENSE',
      title:
        entry.categoryRole === 'PURCHASE'
          ? 'Dibeli'
          : entry.categoryRole === 'SALE'
            ? 'TERJUAL'
            : (GROUP_LABELS[entry.categoryGroup] ?? 'Pengeluaran'),
      amount: entry.amount,
      voided: entry.voidedAt !== null,
    })
  }

  for (const change of statusChanges) {
    if (change.toStatus === 'SOLD') continue // already covered by the sale entry
    events.push({
      id: `status-${change.id}`,
      date: change.occurredAt,
      kind: 'STATUS',
      title: `Status: ${STATUS_LABELS[change.toStatus]}`,
      detail: change.note,
    })
  }

  for (const photo of photos) {
    events.push({
      id: `photo-${photo.id}`,
      date: photo.takenAt ?? photo.createdAt,
      kind: 'PHOTO',
      title: 'Foto ditambahkan',
      detail: photo.caption,
    })
  }

  for (const doc of documents) {
    events.push({
      id: `doc-${doc.id}`,
      date: doc.createdAt,
      kind: 'DOCUMENT',
      title: `Dokumen: ${doc.type}`,
    })
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime())
}
