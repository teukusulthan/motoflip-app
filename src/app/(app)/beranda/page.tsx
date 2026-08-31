import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  Info,
  Lock,
  TriangleAlert,
} from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getAllEntries, getCashAccounts } from '@/data/finance'
import {
  getExpiringDocuments,
  getMotorcycles,
  getSettings,
} from '@/data/garage'
import { businessSummary, periodTotals } from '@/domain/ledger'
import {
  averageCurrentHolding,
  inventoryAging,
  overallRoi,
} from '@/domain/inventory'
import {
  type AttentionItem,
  DEFAULT_THRESHOLDS,
  buildAttentionItems,
} from '@/domain/attention'
import { endOfMonthUtc, startOfMonthUtc } from '@/domain/dates'
import { isInInventory } from '@/domain/types'
import {
  formatDays,
  formatPercent,
  formatRupiah,
  formatRupiahCompact,
} from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Stat, StatRow } from '@/components/motorflip/stat'
import { EmptyState } from '@/components/motorflip/empty-state'
import { PageHeader, SectionHeader } from '@/components/motorflip/page-header'

export const metadata = { title: 'Beranda · MotorFlip' }
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await requireUser()

  const [accounts, entries, motorcycles, documents, settings] =
    await Promise.all([
      getCashAccounts(user.id),
      getAllEntries(user.id),
      getMotorcycles(user.id),
      getExpiringDocuments(user.id),
      getSettings(user.id),
    ])

  const now = new Date()
  const summary = businessSummary(accounts, motorcycles, entries)
  const month = periodTotals(entries, startOfMonthUtc(now), endOfMonthUtc(now))
  const aging = inventoryAging(motorcycles, entries, now)
  const activeCount = motorcycles.filter((m) => isInInventory(m.status)).length

  const attention = buildAttentionItems(
    motorcycles,
    entries,
    documents,
    {
      ...DEFAULT_THRESHOLDS,
      agingWarnDays: settings?.agingWarnDays ?? DEFAULT_THRESHOLDS.agingWarnDays,
      agingCriticalDays:
        settings?.agingCriticalDays ?? DEFAULT_THRESHOLDS.agingCriticalDays,
      repairOverrunWarnBps:
        settings?.repairOverrunWarnBps ?? DEFAULT_THRESHOLDS.repairOverrunWarnBps,
      lowMarginWarnBps:
        settings?.lowMarginWarnBps ?? DEFAULT_THRESHOLDS.lowMarginWarnBps,
    },
    now,
  )

  if (motorcycles.length === 0) {
    return (
      <>
        <PageHeader title={`Halo, ${user.name}`} subtitle="Mari mulai." />
        <EmptyState
          icon={Bike}
          title="Belum ada motor."
          description="Mulai dengan menambahkan motor pertama Anda, lalu lacak seluruh perjalanan flipping-nya — biaya, foto, dokumen, hingga keuntungan bersih."
          actionLabel="+ Tambah Motor"
          actionHref="/garasi/baru"
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title={`Halo, ${user.name}`}
        subtitle={`${activeCount} motor aktif · ${formatRupiahCompact(summary.inventoryCapital)} modal terkunci`}
      />

      {/* Headline figures — the three questions of §16. */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
          <div className="p-4">
            <Stat
              label="Kas Tersedia"
              value={formatRupiahCompact(summary.availableCash)}
              size="lg"
              tone={summary.availableCash < 0n ? 'negative' : 'default'}
            />
          </div>
          <div className="p-4">
            <Stat
              label="Modal di Inventori"
              value={formatRupiahCompact(summary.inventoryCapital)}
              size="lg"
              tone="muted"
            />
          </div>
        </div>
        <CardContent className="space-y-0 py-1">
          <StatRow
            label="Total Aset"
            value={formatRupiah(summary.totalAssets)}
          />
          <StatRow
            label="Laba Terealisasi"
            value={formatRupiah(summary.realizedProfit)}
            tone={summary.realizedProfit >= 0n ? 'positive' : 'negative'}
          />
          <StatRow
            label="Rata-rata ROI"
            value={formatPercent(overallRoi(motorcycles, entries))}
            tone="accent"
          />
        </CardContent>
      </Card>

      {/* This month */}
      <section className="mt-6">
        <SectionHeader title="Bulan Ini" />
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3">
            <Stat
              label="Pemasukan"
              value={formatRupiahCompact(month.revenue)}
              size="sm"
              tone="positive"
            />
          </Card>
          <Card className="p-3">
            <Stat
              label="Pengeluaran"
              value={formatRupiahCompact(month.expenses)}
              size="sm"
              tone="negative"
            />
          </Card>
          <Card className="p-3">
            <Stat
              label="Selisih"
              value={formatRupiahCompact(month.net)}
              size="sm"
              tone={month.net >= 0n ? 'positive' : 'negative'}
            />
          </Card>
        </div>
      </section>

      {/* Inventory */}
      <section className="mt-6">
        <SectionHeader
          title="Inventori"
          action={
            <Link
              href="/garasi"
              className="flex items-center gap-1 text-xs font-semibold text-accent"
            >
              Lihat semua
              <ArrowRight className="size-3" aria-hidden />
            </Link>
          }
        />
        <Card>
          <CardContent className="py-1">
            <StatRow label="Motor aktif" value={String(activeCount)} />
            <StatRow
              label="Nilai estimasi"
              value={formatRupiah(summary.inventoryEstimatedValue)}
            />
            <StatRow
              label="Potensi laba belum terealisasi"
              value={formatRupiah(summary.unrealizedProfit)}
              tone={summary.unrealizedProfit >= 0n ? 'positive' : 'negative'}
            />
            <StatRow
              label="Rata-rata lama simpan"
              value={formatDays(averageCurrentHolding(aging))}
            />
          </CardContent>
        </Card>
      </section>

      {/* Attention — §4 */}
      <section className="mt-6">
        <SectionHeader title="Perlu Perhatian" />
        {attention.length === 0 ? (
          <Card>
            <CardContent className="flex items-center gap-3 py-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-muted text-success">
                <Info className="size-4" aria-hidden />
              </span>
              <p className="text-sm text-fg-muted">
                Tidak ada yang perlu ditindaklanjuti saat ini.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {attention.slice(0, 5).map((item) => (
              <AttentionCard key={item.id} item={item} />
            ))}
          </ul>
        )}
      </section>

      {/* Market — §39: an honest placeholder, never fake data. */}
      <section className="mt-6">
        <SectionHeader title="Peluang Pasar" />
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-elevated text-fg-subtle">
              <Lock className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">
                Data pasar belum tersedia
              </p>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                Intelijen pasar akan aktif setelah sumber data eksternal
                terhubung. MotorFlip tidak menampilkan angka pasar buatan.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}

function AttentionCard({ item }: { item: AttentionItem }) {
  const tone = {
    danger: {
      wrap: 'border-danger/30 bg-danger-muted/40',
      icon: 'bg-danger/15 text-danger',
      Icon: TriangleAlert,
    },
    warning: {
      wrap: 'border-warning/30 bg-warning-muted/30',
      icon: 'bg-warning/15 text-warning',
      Icon: AlertTriangle,
    },
    info: {
      wrap: 'border-border bg-surface',
      icon: 'bg-elevated text-fg-muted',
      Icon: Info,
    },
  }[item.severity]

  const body = (
    <div className={`flex items-start gap-3 rounded-lg border p-3 ${tone.wrap}`}>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-md ${tone.icon}`}
      >
        <tone.Icon className="size-4" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug text-fg">
          {item.title}
        </p>
        <p className="mt-0.5 text-xs leading-relaxed text-fg-muted">
          {item.detail}
        </p>
      </div>
    </div>
  )

  return (
    <li>
      {item.motorcycleId ? (
        <Link href={`/garasi/${item.motorcycleId}`}>{body}</Link>
      ) : (
        body
      )}
    </li>
  )
}
