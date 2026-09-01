import { Calculator } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { formatDate, formatPercent, formatRupiah } from '@/lib/format'
import { BAND_LABELS, type DealBand } from '@/domain/deal-score'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/motoflip/empty-state'
import { PageHeader } from '@/components/motoflip/page-header'

export const metadata = { title: 'Riwayat Analisa · motoflip' }
export const dynamic = 'force-dynamic'

interface Snapshot {
  score?: number
  band?: DealBand
  projectedProfit?: string
  projectedRoiBps?: number | null
  marketCounted?: boolean
}

const BAND_TONE: Record<DealBand, 'success' | 'accent' | 'warning' | 'danger'> = {
  STRONG_BUY: 'success',
  CONSIDER: 'accent',
  MARGINAL: 'warning',
  AVOID: 'danger',
}

/**
 * §21 — past analyses.
 *
 * Each row renders the frozen snapshot stored at analysis time, so tuning the
 * scoring configuration later never silently rewrites a decision you already
 * made (§38).
 */
export default async function DealHistoryPage() {
  const user = await requireUser()
  const analyses = await prisma.dealAnalysis.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  if (analyses.length === 0) {
    return (
      <>
        <PageHeader title="Riwayat Analisa" backHref="/lainnya" />
        <EmptyState
          icon={Calculator}
          title="Belum ada analisa tersimpan."
          description="Setiap deal yang Anda hitung tersimpan di sini beserta skornya saat itu, sehingga Anda bisa membandingkan penilaian awal dengan hasil sebenarnya."
          actionLabel="Analisa Deal"
          actionHref="/analisa-deal"
        />
      </>
    )
  }

  return (
    <>
      <PageHeader
        title="Riwayat Analisa"
        subtitle={`${analyses.length} analisa tersimpan`}
        backHref="/lainnya"
      />

      <ul className="space-y-2">
        {analyses.map((analysis) => {
          const snapshot = (analysis.resultSnapshot ?? {}) as Snapshot
          const band = snapshot.band
          const profit = snapshot.projectedProfit
            ? BigInt(snapshot.projectedProfit)
            : null

          return (
            <li key={analysis.id}>
              <Card className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="truncate text-sm font-semibold text-fg">
                      {[analysis.brand, analysis.model, analysis.year]
                        .filter(Boolean)
                        .join(' ')}
                    </h2>
                    <p className="mt-0.5 text-xs text-fg-subtle">
                      {formatDate(analysis.createdAt)}
                      {snapshot.marketCounted === false && ' · tanpa data pasar'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {band && <Badge tone={BAND_TONE[band]}>{BAND_LABELS[band]}</Badge>}
                    {snapshot.score !== undefined && (
                      <span className="tabular rounded-md bg-accent/12 px-2.5 py-1 text-metric-sm text-accent">
                        {snapshot.score}
                      </span>
                    )}
                  </div>
                </div>

                <dl className="mt-4 grid grid-cols-3 gap-3">
                  <Figure
                    label="Beli"
                    value={formatRupiah(analysis.expectedPurchase)}
                  />
                  <Figure
                    label="Jual"
                    value={formatRupiah(analysis.expectedSale)}
                  />
                  <Figure
                    label="Laba"
                    value={formatRupiah(profit)}
                    tone={
                      profit === null
                        ? undefined
                        : profit >= 0n
                          ? 'text-success'
                          : 'text-danger'
                    }
                  />
                </dl>

                {snapshot.projectedRoiBps !== undefined &&
                  snapshot.projectedRoiBps !== null && (
                    <p className="mt-3 border-t border-border pt-2.5 text-xs text-fg-subtle">
                      ROI proyeksi {formatPercent(snapshot.projectedRoiBps)}
                    </p>
                  )}
              </Card>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Figure({
  label,
  value,
  tone,
}: {
  label: string
  value: string
  tone?: string
}) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-subtle">
        {label}
      </dt>
      <dd className={`tabular mt-0.5 truncate text-metric-sm ${tone ?? 'text-fg'}`}>
        {value}
      </dd>
    </div>
  )
}
