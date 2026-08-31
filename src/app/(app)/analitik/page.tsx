import { BarChart3 } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getAllEntries, getCashAccounts, getVendors } from '@/data/finance'
import { getMotorcycles } from '@/data/garage'
import { businessSummary, periodTotals } from '@/domain/ledger'
import {
  AGING_BUCKETS,
  agingDistribution,
  averageCurrentHolding,
  averageDaysToSell,
  inventoryAging,
  overallRoi,
  performanceByModel,
  performanceBySource,
  vendorSpend,
} from '@/domain/inventory'
import { costBreakdown } from '@/domain/costing'
import { endOfMonthUtc, startOfMonthUtc } from '@/domain/dates'
import {
  formatDays,
  formatPercent,
  formatRupiah,
  formatRupiahCompact,
} from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Stat, StatRow } from '@/components/motoflip/stat'
import { EmptyState } from '@/components/motoflip/empty-state'
import { PageHeader, SectionHeader } from '@/components/motoflip/page-header'

export const metadata = { title: 'Analitik · motoflip' }
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

export default async function AnalyticsPage() {
  const user = await requireUser()

  const [motorcycles, entries, accounts, vendors] = await Promise.all([
    getMotorcycles(user.id),
    getAllEntries(user.id),
    getCashAccounts(user.id),
    getVendors(user.id),
  ])

  if (motorcycles.length === 0) {
    return (
      <>
        <PageHeader title="Analitik" />
        <EmptyState
          icon={BarChart3}
          title="Belum ada data untuk dianalisis."
          description="Analitik akan terisi setelah Anda mencatat motor pertama beserta biaya dan penjualannya."
          actionLabel="+ Tambah Motor"
          actionHref="/garasi/baru"
        />
      </>
    )
  }

  const now = new Date()
  const summary = businessSummary(accounts, motorcycles, entries)
  const month = periodTotals(entries, startOfMonthUtc(now), endOfMonthUtc(now))
  const aging = inventoryAging(motorcycles, entries, now)
  const distribution = agingDistribution(aging)
  const bySource = performanceBySource(motorcycles, entries)
  const byModel = performanceByModel(motorcycles, entries)
  const spend = vendorSpend(entries)
  const breakdown = Object.entries(costBreakdown(entries)).filter(
    ([, value]) => value > 0n,
  )
  const vendorName = (id: string) =>
    vendors.find((v) => v.id === id)?.name ?? 'Vendor'

  const totalAging = aging.length

  return (
    <>
      <PageHeader
        title="Analitik"
        subtitle="Kinerja bisnis Anda dari data yang tercatat"
      />

      <section>
        <SectionHeader title="Ringkasan" />
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <Stat
              label="Laba Terealisasi"
              value={formatRupiahCompact(summary.realizedProfit)}
              tone={summary.realizedProfit >= 0n ? 'positive' : 'negative'}
            />
          </Card>
          <Card className="p-4">
            <Stat
              label="ROI Keseluruhan"
              value={formatPercent(overallRoi(motorcycles, entries))}
              tone="accent"
            />
          </Card>
          <Card className="p-4">
            <Stat
              label="Rata-rata Hari Jual"
              value={formatDays(averageDaysToSell(motorcycles, entries))}
            />
          </Card>
          <Card className="p-4">
            <Stat
              label="Rata-rata Simpan"
              value={formatDays(averageCurrentHolding(aging))}
            />
          </Card>
        </div>
      </section>

      <section className="mt-6">
        <SectionHeader title="Bulan Ini" />
        <Card>
          <CardContent className="py-1">
            <StatRow label="Pemasukan" value={formatRupiah(month.revenue)} tone="positive" />
            <StatRow label="Pengeluaran" value={formatRupiah(month.expenses)} tone="negative" />
            <StatRow
              label="Selisih"
              value={formatRupiah(month.net)}
              tone={month.net >= 0n ? 'positive' : 'negative'}
              emphasis
            />
          </CardContent>
        </Card>
      </section>

      {/* §18 — inventory aging */}
      <section className="mt-6">
        <SectionHeader title="Umur Inventori" />
        {totalAging === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-fg-muted">
                Tidak ada motor di inventori saat ini.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="space-y-3">
              {AGING_BUCKETS.map((bucket) => {
                const cell = distribution[bucket]
                const share = Math.round((cell.count / totalAging) * 100)
                const critical = bucket === '60+' && cell.count > 0
                return (
                  <div key={bucket}>
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="text-sm text-fg-muted">
                        {bucket} hari
                      </span>
                      <span className="tabular text-sm text-fg">
                        {cell.count} unit
                        <span className="ml-2 text-xs text-fg-subtle">
                          {formatRupiahCompact(cell.capital)}
                        </span>
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated"
                      role="img"
                      aria-label={`${share}% dari inventori`}
                    >
                      <div
                        className={
                          critical ? 'h-full bg-danger' : 'h-full bg-accent'
                        }
                        style={{ width: `${share}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>
        )}
      </section>

      {/* §17 — expenses by category */}
      <section className="mt-6">
        <SectionHeader title="Pengeluaran per Kategori" />
        <Card>
          <CardContent className="py-1">
            {breakdown.length === 0 ? (
              <p className="py-3 text-sm text-fg-muted">Belum ada pengeluaran.</p>
            ) : (
              breakdown
                .sort((a, b) => (b[1] > a[1] ? 1 : -1))
                .map(([group, value]) => (
                  <StatRow
                    key={group}
                    label={GROUP_LABELS[group] ?? group}
                    value={formatRupiah(value)}
                  />
                ))
            )}
          </CardContent>
        </Card>
      </section>

      {/* §19 — acquisition source */}
      <section className="mt-6">
        <SectionHeader title="Kinerja per Sumber Akuisisi" />
        {bySource.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-fg-muted">
                Analitik ini terisi setelah Anda menjual motor pertama.
              </p>
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {bySource.map((group) => (
              <li key={group.key}>
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-fg">
                        {group.label}
                      </span>
                      <span className="tabular shrink-0 text-metric-sm text-accent">
                        {formatPercent(group.roi)}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-fg-subtle">
                      <span>{group.count} unit</span>
                      <span>Laba {formatRupiahCompact(group.netProfit)}</span>
                      <span>{formatDays(group.averageDaysToSell)}</span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* §17 — per model */}
      {byModel.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Kinerja per Model" />
          <ul className="space-y-2">
            {byModel.map((group) => (
              <li key={group.key}>
                <Card>
                  <CardContent className="py-3">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="truncate text-sm font-semibold text-fg">
                        {group.label}
                      </span>
                      <span className="tabular shrink-0 text-metric-sm text-accent">
                        {formatPercent(group.roi)}
                      </span>
                    </div>
                    <div className="mt-1 flex gap-4 text-xs text-fg-subtle">
                      <span>{group.count} unit</span>
                      <span>Laba {formatRupiahCompact(group.netProfit)}</span>
                      <span>{formatDays(group.averageDaysToSell)}</span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* §20 — vendors */}
      {spend.length > 0 && (
        <section className="mt-6">
          <SectionHeader title="Pengeluaran per Vendor" />
          <Card>
            <CardContent className="py-1">
              {spend.map((row) => (
                <StatRow
                  key={row.vendorId}
                  label={`${vendorName(row.vendorId)} · ${row.transactions}×`}
                  value={formatRupiah(row.totalSpend)}
                />
              ))}
            </CardContent>
          </Card>
        </section>
      )}
    </>
  )
}
