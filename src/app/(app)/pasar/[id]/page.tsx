import { notFound } from 'next/navigation'

import { requireUser } from '@/server/auth'
import { getAllEntries } from '@/data/finance'
import { getMotorcycles } from '@/data/garage'
import {
  getMarketModel,
  getMarketView,
  getObservations,
  getWatchlistIds,
} from '@/data/market'
import { scoreOpportunity } from '@/domain/market/opportunity'
import {
  MARKET_BAND_LABELS,
  marketBand,
} from '@/domain/market/scoring'
import { OPPORTUNITY_BAND_LABELS } from '@/domain/market/opportunity'
import { marketModelLabel } from '@/domain/market/types'
import {
  formatDays,
  formatPercent,
  formatPercentSigned,
  formatRupiah,
} from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { PageHeader, SectionHeader } from '@/components/motoflip/page-header'
import { StatRow } from '@/components/motoflip/stat'
import {
  ConfidenceBadge,
  MissingSignals,
  ProvenanceNotice,
} from '@/components/market/provenance'
import { TrendChart } from '@/components/market/trend-chart'
import { ObservationPanel } from './observation-panel'
import { WatchToggle } from './watch-toggle'
import { cn } from '@/lib/utils'

export const dynamic = 'force-dynamic'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

export default async function MarketModelPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params

  const row = await getMarketModel(user.id, id)
  if (!row) notFound()

  const [view, observations, watchlist, motorcycles, entries] =
    await Promise.all([
      getMarketView(user.id, row),
      getObservations(user.id, row.id),
      getWatchlistIds(user.id),
      getMotorcycles(user.id),
      getAllEntries(user.id),
    ])

  const opportunity = scoreOpportunity(view, motorcycles, entries)
  const { market, personal } = opportunity
  const band = marketBand(market.score)
  const label = marketModelLabel(view.ref)

  return (
    <>
      <PageHeader
        title={label}
        subtitle={band ? MARKET_BAND_LABELS[band] : 'Belum dinilai'}
        backHref="/pasar"
        action={
          <WatchToggle
            marketModelId={row.id}
            watched={watchlist.has(row.id)}
          />
        }
      />

      <ProvenanceNotice provenance={view.provenance} className="mb-5" />

      {/* §28 — three separate scores, never silently merged. */}
      <section>
        <SectionHeader title="Skor Peluang" />
        <Card>
          <CardContent>
            <div className="text-center">
              <p
                className={cn(
                  'tabular text-5xl font-bold',
                  opportunity.combined === null
                    ? 'text-fg-subtle'
                    : opportunity.confidence === 'NONE'
                      ? 'text-warning'
                      : 'text-accent',
                )}
              >
                {opportunity.combined ?? '—'}
                {opportunity.combined !== null && (
                  <span className="text-xl font-semibold text-fg-subtle">
                    /100
                  </span>
                )}
              </p>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
                {opportunity.band && (
                  <Badge tone={opportunity.confidence === 'NONE' ? 'warning' : 'accent'}>
                    {OPPORTUNITY_BAND_LABELS[opportunity.band]}
                  </Badge>
                )}
                <ConfidenceBadge confidence={opportunity.confidence} />
              </div>
              <p className="mx-auto mt-3 max-w-[40ch] text-xs leading-relaxed text-fg-muted">
                {opportunity.basis}
              </p>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-border pt-4">
              <SubScore
                label="Skor Pasar"
                score={market.score}
                share={opportunity.marketShare}
                muted={market.confidence === 'NONE'}
              />
              <SubScore
                label="Skor Pribadi"
                score={personal.score}
                share={opportunity.personalShare}
                muted={personal.score === null}
              />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* §26 — trend history */}
      <section className="mt-6">
        <SectionHeader title="Riwayat Permintaan" />
        <Card>
          <CardContent>
            <TrendChart
              ariaLabel={`Indeks permintaan ${label} per bulan`}
              points={view.history.map((snapshot) => ({
                label: MONTHS[snapshot.periodStart.getUTCMonth()] ?? '',
                value: snapshot.demandIndex,
                synthetic: snapshot.provenance.source === 'DEMO',
              }))}
            />
            {market.demandGrowthBps !== null && (
              <p className="mt-3 border-t border-border pt-3 text-sm text-fg-muted">
                Perubahan bulan terakhir:{' '}
                <span
                  className={cn(
                    'tabular font-semibold',
                    market.demandGrowthBps >= 0 ? 'text-success' : 'text-danger',
                  )}
                >
                  {formatPercentSigned(market.demandGrowthBps)}
                </span>
              </p>
            )}
          </CardContent>
        </Card>
      </section>

      {/* §23 — transparent component breakdown */}
      <section className="mt-6">
        <SectionHeader title="Komponen Skor Pasar" />
        <Card>
          <CardContent className="space-y-4">
            {market.components.map((component) => (
              <div key={component.key}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-sm font-medium text-fg">
                    {component.label}
                  </span>
                  <span className="tabular shrink-0 text-sm text-fg-muted">
                    {component.score === null
                      ? 'Tidak dinilai'
                      : `${Math.round(component.score)}/100`}
                    <span className="ml-1.5 text-xs text-fg-subtle">
                      bobot {component.weight}
                    </span>
                  </span>
                </div>
                {component.score !== null && (
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-elevated">
                    <div
                      className={cn(
                        'h-full',
                        market.confidence === 'NONE' ? 'bg-warning/50' : 'bg-accent',
                      )}
                      style={{ width: `${Math.round(component.score)}%` }}
                    />
                  </div>
                )}
                <p className="mt-1 text-xs leading-relaxed text-fg-subtle">
                  {component.rationale}
                </p>
              </div>
            ))}
            <div className="border-t border-border pt-3">
              <MissingSignals signals={market.missingSignals} />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* Market figures */}
      <section className="mt-6">
        <SectionHeader title="Angka Pasar" />
        <Card>
          <CardContent className="py-1">
            <StatRow
              label="Perkiraan harga beli (P25)"
              value={formatRupiah(market.estimatedBuyPrice)}
            />
            <StatRow
              label="Harga tengah pasar"
              value={formatRupiah(market.medianPrice)}
            />
            <StatRow
              label="Rata-rata hari terjual"
              value={formatDays(market.avgDaysToSell)}
            />
            <StatRow
              label="Unit sedang dijual"
              value={market.listingCount === null ? '—' : String(market.listingCount)}
            />
          </CardContent>
        </Card>
      </section>

      {/* §28 — personal track record */}
      <section className="mt-6">
        <SectionHeader title="Rekam Jejak Anda" />
        <Card>
          <CardContent className="py-1">
            {personal.performance.flips === 0 ? (
              <p className="py-3 text-sm leading-relaxed text-fg-muted">
                {personal.rationale}
              </p>
            ) : (
              <>
                <StatRow
                  label="Flip selesai"
                  value={String(personal.performance.flips)}
                />
                <StatRow
                  label="ROI Anda"
                  value={formatPercent(personal.performance.roi)}
                  tone="accent"
                />
                <StatRow
                  label="Rata-rata lama jual"
                  value={formatDays(personal.performance.averageDaysToSell)}
                />
                <StatRow
                  label="Total laba"
                  value={formatRupiah(personal.performance.totalProfit)}
                  tone={
                    personal.performance.totalProfit >= 0n ? 'positive' : 'negative'
                  }
                />
                <StatRow
                  label="Flip terbaik"
                  value={formatRupiah(personal.performance.bestProfit)}
                />
                <StatRow
                  label="Flip terburuk"
                  value={formatRupiah(personal.performance.worstProfit)}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* Real market observations */}
      <section className="mt-6">
        <SectionHeader title="Observasi Pasar" />
        <ObservationPanel
          marketModelId={row.id}
          observations={observations.map((o) => ({
            id: o.id,
            observedAt: o.observedAt.toISOString(),
            askingPrice: o.askingPrice.toString(),
            source: o.source,
            mileage: o.mileage,
            listingAgeDays: o.listingAgeDays,
            url: o.url,
            note: o.note,
          }))}
        />
      </section>
    </>
  )
}

function SubScore({
  label,
  score,
  share,
  muted,
}: {
  label: string
  score: number | null
  share: number
  muted: boolean
}) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </p>
      <p
        className={cn(
          'tabular mt-1 text-metric',
          muted ? 'text-fg-subtle' : 'text-fg',
        )}
      >
        {score ?? '—'}
      </p>
      <p className="mt-0.5 text-xs text-fg-subtle">
        {score === null ? 'tidak dinilai' : `bobot ${share}%`}
      </p>
    </div>
  )
}

