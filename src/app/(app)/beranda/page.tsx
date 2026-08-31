import Link from 'next/link'
import {
  AlertTriangle,
  ArrowRight,
  Bike,
  Flame,
  Info,
  Lock,
  TriangleAlert,
} from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getAllEntries, getCashAccounts } from '@/data/finance'
import { getMarketViews } from '@/data/market'
import { scoreOpportunity } from '@/domain/market/opportunity'
import { OPPORTUNITY_BAND_LABELS } from '@/domain/market/opportunity'
import { marketModelLabel } from '@/domain/market/types'
import { formatPercentSigned } from '@/lib/format'
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
import { cn } from '@/lib/utils'
import { Stat, StatRow } from '@/components/motorflip/stat'
import { EmptyState } from '@/components/motorflip/empty-state'
import { PageHeader, SectionHeader } from '@/components/motorflip/page-header'

export const metadata = { title: 'Beranda · MotorFlip' }
export const dynamic = 'force-dynamic'

export default async function HomePage() {
  const user = await requireUser()

  const [accounts, entries, motorcycles, documents, settings, marketViews] =
    await Promise.all([
      getCashAccounts(user.id),
      getAllEntries(user.id),
      getMotorcycles(user.id),
      getExpiringDocuments(user.id),
      getSettings(user.id),
      getMarketViews(user.id),
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

      {/* §4 — market opportunities, ranked by combined score. */}
      <MarketOpportunities
        opportunities={marketViews
          .map((view) => scoreOpportunity(view, motorcycles, entries))
          .map((opportunity, index) => ({
            opportunity,
            view: marketViews[index] as (typeof marketViews)[number],
          }))
          .filter((entry) => entry.opportunity.combined !== null)
          .sort(
            (a, b) =>
              (b.opportunity.combined as number) -
              (a.opportunity.combined as number),
          )
          .slice(0, 3)}
        tracked={marketViews.length}
      />
    </>
  )
}

function MarketOpportunities({
  opportunities,
  tracked,
}: {
  opportunities: {
    opportunity: ReturnType<typeof scoreOpportunity>
    view: { ref: Parameters<typeof marketModelLabel>[0] }
  }[]
  tracked: number
}) {
  return (
    <section className="mt-6">
      <SectionHeader
        title="Peluang Pasar"
        action={
          <Link
            href="/pasar"
            className="flex items-center gap-1 text-xs font-semibold text-accent"
          >
            Lihat pasar
            <ArrowRight className="size-3" aria-hidden />
          </Link>
        }
      />

      {tracked === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-elevated text-fg-subtle">
              <Lock className="size-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">
                Belum ada model yang dipantau
              </p>
              <p className="mt-1 text-sm leading-relaxed text-fg-muted">
                Pantau model di halaman Pasar untuk melihat peluang pembelian
                berdasarkan pasar dan rekam jejak Anda.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : opportunities.length === 0 ? (
        <Card className="border-dashed">
          <CardContent>
            <p className="text-sm text-fg-muted">
              Belum cukup data untuk menilai peluang pada model yang dipantau.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2">
          {opportunities.map(({ opportunity, view }) => {
            const illustration = opportunity.confidence === 'NONE'
            return (
              <li key={view.ref.id}>
                <Link
                  href={`/pasar/${view.ref.id}`}
                  className={cn(
                    'block rounded-lg border p-4 transition-colors',
                    illustration
                      ? 'border-dashed border-warning/40 bg-warning-muted/20 hover:border-warning/60'
                      : 'border-border bg-surface hover:border-accent/40',
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-fg">
                        {!illustration && (
                          <Flame className="size-3.5 shrink-0 text-accent" aria-hidden />
                        )}
                        {marketModelLabel(view.ref)}
                      </p>
                      <p className="mt-0.5 text-xs text-fg-muted">
                        {opportunity.band
                          ? OPPORTUNITY_BAND_LABELS[opportunity.band]
                          : '—'}
                        {opportunity.market.demandGrowthBps !== null &&
                          ` · Permintaan ${formatPercentSigned(opportunity.market.demandGrowthBps)}`}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'tabular shrink-0 rounded-md px-2.5 py-1 text-metric-sm',
                        illustration
                          ? 'border border-dashed border-warning/40 text-warning'
                          : 'bg-accent/12 text-accent',
                      )}
                    >
                      {opportunity.combined}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-fg-subtle">
                    {opportunity.basis}
                  </p>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </section>
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
