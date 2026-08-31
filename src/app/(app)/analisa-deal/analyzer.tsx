'use client'

import * as React from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { AlertCircle, Info, TriangleAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { MoneyInput } from '@/components/motoflip/money-input'
import { SectionHeader } from '@/components/motoflip/page-header'
import { StatRow } from '@/components/motoflip/stat'
import {
  formatDays,
  formatPercent,
  formatRupiah,
} from '@/lib/format'
import { BAND_LABELS, CONFIDENCE_LABELS } from '@/domain/deal-score'
import { CONFIDENCE_LABELS as MARKET_CONFIDENCE_LABELS } from '@/domain/market/types'
import { cn } from '@/lib/utils'
import type { DealAnalysisView } from './action'

const initialState: DealAnalysisView = {}

export function DealAnalyzer({
  action,
  historyCount,
}: {
  action: (
    prev: DealAnalysisView,
    formData: FormData,
  ) => Promise<DealAnalysisView>
  historyCount: number
}) {
  const [state, formAction] = useFormState(action, initialState)
  const resultRef = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (state.result) {
      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }, [state.result])

  return (
    <div className="space-y-6 pb-10">
      <form action={formAction} className="space-y-4">
        {state.error && (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger-muted px-3 py-2.5 text-sm text-danger"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>{state.error}</span>
          </div>
        )}

        <Card>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="brand">Merek</Label>
                <Input id="brand" name="brand" required placeholder="Yamaha" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="model">Model</Label>
                <Input id="model" name="model" required placeholder="NMAX" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="year">Tahun</Label>
              <Input
                id="year"
                name="year"
                type="number"
                inputMode="numeric"
                required
                placeholder="2022"
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="sellerPrice">Harga Penjual</Label>
              <MoneyInput
                id="sellerPrice"
                name="sellerPrice"
                required
                quickAdd={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedPurchase">Perkiraan Harga Beli</Label>
              <MoneyInput
                id="expectedPurchase"
                name="expectedPurchase"
                required
                quickAdd={false}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="estimatedRepair">Estimasi Perbaikan</Label>
              <MoneyInput id="estimatedRepair" name="estimatedRepair" required />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="expectedSale">Perkiraan Harga Jual</Label>
              <MoneyInput
                id="expectedSale"
                name="expectedSale"
                required
                quickAdd={false}
              />
            </div>
          </CardContent>
        </Card>

        <SubmitButton />
      </form>

      {state.result && (
        <div ref={resultRef} className="space-y-6 scroll-mt-4">
          <ResultPanel result={state.result} historyCount={historyCount} />
        </div>
      )}
    </div>
  )
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <Button type="submit" size="full" disabled={pending}>
      {pending ? 'Menghitung…' : 'Analisa Deal'}
    </Button>
  )
}

const BAND_STYLES = {
  STRONG_BUY: { ring: 'text-success', chip: 'success' },
  CONSIDER: { ring: 'text-accent', chip: 'accent' },
  MARGINAL: { ring: 'text-warning', chip: 'warning' },
  AVOID: { ring: 'text-danger', chip: 'danger' },
} as const

function ResultPanel({
  result,
  historyCount,
}: {
  result: NonNullable<DealAnalysisView['result']>
  historyCount: number
}) {
  const style = BAND_STYLES[result.band]
  const profit = BigInt(result.projectedProfit)

  return (
    <>
      <section>
        <SectionHeader title="Proyeksi" />
        <Card>
          <CardContent className="py-1">
            <StatRow
              label="Biaya Proyeksi"
              value={formatRupiah(BigInt(result.projectedCost))}
            />
            <StatRow
              label="Laba Proyeksi"
              value={formatRupiah(profit)}
              tone={profit >= 0n ? 'positive' : 'negative'}
            />
            <StatRow
              label="ROI Proyeksi"
              value={formatPercent(result.projectedRoiBps)}
              tone="accent"
              emphasis
            />
            <StatRow
              label="Hemat dari Nego"
              value={formatRupiah(BigInt(result.negotiationSaving))}
            />
            <StatRow
              label="Porsi Perbaikan"
              value={formatPercent(result.repairShareBps)}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Skor Deal" />
        <Card>
          <CardContent className="text-center">
            <p className={cn('tabular text-5xl font-bold', style.ring)}>
              {result.score}
              <span className="text-xl font-semibold text-fg-subtle">/100</span>
            </p>
            <div className="mt-3 flex items-center justify-center gap-2">
              <Badge tone={style.chip}>{BAND_LABELS[result.band]}</Badge>
              <Badge tone="neutral">
                Keyakinan {CONFIDENCE_LABELS[result.confidence]}
              </Badge>
            </div>
          </CardContent>
        </Card>
      </section>

      <section>
        <SectionHeader title="Komponen Skor" />
        <Card>
          <CardContent className="space-y-4">
            {result.components.map((component) => (
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
                      className="h-full bg-accent"
                      style={{ width: `${Math.round(component.score)}%` }}
                    />
                  </div>
                )}
                <p className="mt-1 text-xs leading-relaxed text-fg-subtle">
                  {component.rationale}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* §30 — the market half */}
      <section>
        <SectionHeader title="Pasar" />
        {result.market === null ? (
          <Card className="border-dashed">
            <CardContent className="flex items-start gap-3">
              <Info className="mt-0.5 size-4 shrink-0 text-fg-subtle" aria-hidden />
              <p className="text-xs leading-relaxed text-fg-muted">
                Model ini belum dipantau. Tambahkan di halaman{' '}
                <span className="font-semibold text-fg">Pasar</span> agar
                analisa berikutnya bisa membandingkan harga Anda dengan pasar.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className={result.market.counted ? undefined : 'border-dashed border-warning/40'}>
            <CardContent className="py-1">
              {!result.market.counted && (
                <p className="border-b border-border py-3 text-xs leading-relaxed text-warning">
                  Angka pasar di bawah ini adalah ilustrasi dan{' '}
                  <span className="font-semibold">tidak memengaruhi skor</span>.
                  Catat listing nyata di halaman Pasar untuk mengaktifkannya.
                </p>
              )}
              <StatRow
                label="Perkiraan harga beli pasar"
                value={
                  result.market.estimatedBuyPrice === null
                    ? '—'
                    : formatRupiah(BigInt(result.market.estimatedBuyPrice))
                }
              />
              <StatRow
                label="Harga tengah pasar"
                value={
                  result.market.medianPrice === null
                    ? '—'
                    : formatRupiah(BigInt(result.market.medianPrice))
                }
              />
              <StatRow
                label="Rata-rata hari terjual"
                value={
                  result.market.avgDaysToSell === null
                    ? '—'
                    : `${result.market.avgDaysToSell} hari`
                }
              />
              <StatRow
                label="Tren permintaan"
                value={
                  result.market.demandGrowthBps === null
                    ? '—'
                    : `${result.market.demandGrowthBps >= 0 ? '+' : ''}${(result.market.demandGrowthBps / 100).toFixed(1)}%`
                }
                tone={
                  result.market.demandGrowthBps === null
                    ? 'default'
                    : result.market.demandGrowthBps >= 0
                      ? 'positive'
                      : 'negative'
                }
              />
              <StatRow
                label="Keyakinan data pasar"
                value={MARKET_CONFIDENCE_LABELS[result.market.confidence]}
              />
            </CardContent>
          </Card>
        )}
      </section>

      <section>
        <SectionHeader title="Rekam Jejak Anda" />
        <Card>
          <CardContent className="py-1">
            {result.history.label === null ? (
              <p className="py-3 text-sm leading-relaxed text-fg-muted">
                {historyCount === 0
                  ? 'Anda belum menjual motor apa pun, jadi belum ada pembanding pribadi. Skor ini murni dari proyeksi angka yang Anda masukkan.'
                  : 'Belum ada riwayat penjualan untuk model ini. Skor ini tidak menggunakan pembanding pribadi.'}
              </p>
            ) : (
              <>
                <StatRow label="Model dibandingkan" value={result.history.label} />
                <StatRow
                  label="Unit terjual"
                  value={String(
                    result.history.matchingYearCount ||
                      result.history.matchingModelCount,
                  )}
                />
                <StatRow
                  label="Rata-rata ROI Anda"
                  value={formatPercent(result.history.averageRoiBps)}
                  tone="accent"
                />
                <StatRow
                  label="Rata-rata lama jual"
                  value={formatDays(result.history.averageDaysToSell)}
                />
              </>
            )}
          </CardContent>
        </Card>
      </section>

      {/* §29/§30/§39 — state plainly what the score could not see. */}
      {result.missingSignals.length > 0 && (
      <section>
        <SectionHeader title="Batas Analisis Ini" />
        <Card className="border-warning/30 bg-warning-muted/20">
          <CardContent className="flex items-start gap-3">
            <TriangleAlert
              className="mt-0.5 size-4 shrink-0 text-warning"
              aria-hidden
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-fg">
                Sinyal yang tidak tersedia
              </p>
              <ul className="mt-1.5 space-y-1">
                {result.missingSignals.map((signal) => (
                  <li
                    key={signal}
                    className="text-xs leading-relaxed text-fg-muted"
                  >
                    • {signal}
                  </li>
                ))}
              </ul>
              <p className="mt-2.5 flex items-start gap-1.5 text-xs leading-relaxed text-fg-subtle">
                <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
                Permintaan pasar yang naik tidak dengan sendirinya berarti flip
                yang bagus. Skor menimbang margin, risiko perbaikan, rekam jejak
                Anda, dan kesesuaian harga terhadap pasar — dan keyakinannya
                turun untuk setiap sinyal yang tidak tersedia.
              </p>
            </div>
          </CardContent>
        </Card>
      </section>
      )}
    </>
  )
}
