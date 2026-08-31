import Link from 'next/link'
import { ArrowDown, ArrowUp, Star, Store } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { getAllEntries } from '@/data/finance'
import { getMotorcycles } from '@/data/garage'
import { activeProvider, getMarketViews, getWatchlistIds } from '@/data/market'
import {
  RANKINGS,
  type RankingKey,
  applyRanking,
  rankModels,
} from '@/domain/market/rankings'
import { marketBand, MARKET_BAND_LABELS } from '@/domain/market/scoring'
import { scoreOpportunity } from '@/domain/market/opportunity'
import { marketModelLabel } from '@/domain/market/types'
import { formatPercentSigned, formatRupiahCompact } from '@/lib/format'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/motorflip/empty-state'
import { PageHeader, SectionHeader } from '@/components/motorflip/page-header'
import { ProvenanceNotice, SyntheticMark } from '@/components/market/provenance'
import { TrackModelPanel } from './track-model'
import { cn } from '@/lib/utils'

export const metadata = { title: 'Pasar · MotorFlip' }
export const dynamic = 'force-dynamic'

export default async function MarketPage({
  searchParams,
}: {
  searchParams: Promise<{ list?: string }>
}) {
  const user = await requireUser()
  const params = await searchParams
  const listKey: RankingKey =
    RANKINGS.find((r) => r.key === params.list)?.key ?? 'profitable'

  const [views, watchlist, motorcycles, entries] = await Promise.all([
    getMarketViews(user.id),
    getWatchlistIds(user.id),
    getMotorcycles(user.id),
    getAllEntries(user.id),
  ])

  const provider = activeProvider()

  if (views.length === 0) {
    return (
      <>
        <PageHeader title="Pasar" subtitle="Intelijen pasar & peluang" />
        <EmptyState
          icon={Store}
          title="Belum ada model yang dipantau."
          description="Tambahkan model dan tahun yang ingin Anda pantau. MotorFlip akan melacak trennya dan membandingkannya dengan rekam jejak flipping Anda sendiri."
        />
        <div className="mt-4">
          <TrackModelPanel />
        </div>
      </>
    )
  }

  const ranked = rankModels(views)
  const list = applyRanking(listKey, ranked)
  const definition = RANKINGS.find((r) => r.key === listKey)

  const watched = ranked.filter((r) => watchlist.has(r.view.ref.id))
  const syntheticCount = views.filter(
    (v) => v.provenance.source === 'DEMO',
  ).length

  return (
    <>
      <PageHeader
        title="Pasar"
        subtitle={`${views.length} model dipantau`}
        action={<TrackModelPanel compact />}
      />

      {/* §39 — the provenance of the whole screen, stated before any number. */}
      {syntheticCount > 0 && provider && (
        <ProvenanceNotice
          className="mb-5"
          provenance={{
            source: 'DEMO',
            retrievedAt: new Date(),
            confidence: 'NONE',
            methodology: `${syntheticCount} dari ${views.length} model masih memakai ${provider.label.toLowerCase()}. Catat listing yang Anda lihat sendiri untuk menggantinya dengan data nyata.`,
            sampleSize: null,
          }}
        />
      )}

      {/* §27 — watchlist */}
      {watched.length > 0 && (
        <section className="mb-6">
          <SectionHeader title="Watchlist Saya" />
          <ul className="space-y-2">
            {watched.map((item) => (
              <li key={item.view.ref.id}>
                <Link
                  href={`/pasar/${item.view.ref.id}`}
                  className="flex items-center gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:border-accent/40"
                >
                  <Star className="size-4 shrink-0 fill-accent text-accent" aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-fg">
                      {marketModelLabel(item.view.ref)}
                    </span>
                    <span className="mt-0.5 block">
                      <SyntheticMark provenance={item.view.provenance} />
                    </span>
                  </span>
                  <GrowthPill bps={item.growthBps} />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* §24 — ranking lists */}
      <nav
        aria-label="Daftar pasar"
        className="no-scrollbar -mx-4 mb-3 flex gap-2 overflow-x-auto px-4"
      >
        {RANKINGS.map((ranking) => {
          const active = ranking.key === listKey
          return (
            <Link
              key={ranking.key}
              href={`/pasar?list=${ranking.key}`}
              aria-current={active ? 'true' : undefined}
              className={cn(
                'flex h-11 shrink-0 items-center rounded-md border px-3.5 text-sm font-semibold transition-colors',
                active
                  ? 'border-accent/50 bg-accent/12 text-accent'
                  : 'border-border bg-surface text-fg-muted hover:text-fg',
              )}
            >
              {ranking.label}
            </Link>
          )
        })}
      </nav>

      {/* Say what the list actually sorts by — never a black-box ordering. */}
      {definition && (
        <p className="mb-4 text-xs leading-relaxed text-fg-subtle">
          {definition.description}
        </p>
      )}

      {list.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <p className="text-sm text-fg-muted">
              Tidak ada model yang memenuhi kriteria daftar ini.
            </p>
            <p className="mt-1 text-xs text-fg-subtle">
              Daftar berbasis tren memerlukan minimal dua bulan riwayat.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-2 lg:space-y-0">
          {list.map((item) => {
            const opportunity = scoreOpportunity(item.view, motorcycles, entries)
            const band = marketBand(item.score.score)

            return (
              <li key={item.view.ref.id}>
                <Link
                  href={`/pasar/${item.view.ref.id}`}
                  className="block rounded-lg border border-border bg-surface p-4 transition-colors hover:border-accent/40"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-semibold text-fg">
                        {marketModelLabel(item.view.ref)}
                      </h3>
                      <div className="mt-1 flex items-center gap-2">
                        {band && (
                          <span className="text-xs text-fg-muted">
                            {MARKET_BAND_LABELS[band]}
                          </span>
                        )}
                        <SyntheticMark provenance={item.view.provenance} />
                      </div>
                    </div>
                    <ScorePill
                      score={item.score.score}
                      synthetic={item.view.provenance.source === 'DEMO'}
                    />
                  </div>

                  <dl className="mt-4 grid grid-cols-3 gap-3">
                    <Metric
                      label="Harga tengah"
                      value={formatRupiahCompact(item.score.medianPrice)}
                    />
                    <Metric
                      label="Hari terjual"
                      value={
                        item.score.avgDaysToSell === null
                          ? '—'
                          : `${item.score.avgDaysToSell}`
                      }
                    />
                    <Metric
                      label="Permintaan"
                      value={formatPercentSigned(item.growthBps)}
                    />
                  </dl>

                  {opportunity.personal.score !== null && (
                    <p className="mt-3 border-t border-border pt-2.5 text-xs text-fg-subtle">
                      Rekam jejak Anda: {opportunity.personal.rationale}
                    </p>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </dt>
      <dd className="tabular mt-0.5 truncate text-metric-sm text-fg">{value}</dd>
    </div>
  )
}

function ScorePill({
  score,
  synthetic,
}: {
  score: number | null
  synthetic: boolean
}) {
  if (score === null) {
    return <Badge tone="neutral">Belum dinilai</Badge>
  }
  return (
    <span
      className={cn(
        'tabular shrink-0 rounded-md px-2.5 py-1 text-metric-sm',
        synthetic
          ? 'border border-dashed border-warning/40 text-warning'
          : 'bg-accent/12 text-accent',
      )}
    >
      {score}
    </span>
  )
}

function GrowthPill({ bps }: { bps: number | null }) {
  if (bps === null) {
    return <span className="shrink-0 text-xs text-fg-subtle">—</span>
  }
  const up = bps >= 0
  return (
    <span
      className={cn(
        'tabular flex shrink-0 items-center gap-1 text-sm font-semibold',
        up ? 'text-success' : 'text-danger',
      )}
    >
      {up ? (
        <ArrowUp className="size-3" aria-hidden />
      ) : (
        <ArrowDown className="size-3" aria-hidden />
      )}
      {Math.abs(bps / 100).toFixed(1)}%
    </span>
  )
}
