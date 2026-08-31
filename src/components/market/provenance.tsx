import { FlaskConical, Info, ShieldCheck } from 'lucide-react'
import {
  CONFIDENCE_LABELS,
  type MarketConfidence,
  type Provenance,
} from '@/domain/market/types'
import { Badge } from '@/components/ui/badge'
import { formatDate } from '@/lib/format'
import { cn } from '@/lib/utils'

const CONFIDENCE_TONE: Record<
  MarketConfidence,
  'neutral' | 'warning' | 'info' | 'success'
> = {
  NONE: 'warning',
  LOW: 'neutral',
  MEDIUM: 'info',
  HIGH: 'success',
}

export function ConfidenceBadge({
  confidence,
}: {
  confidence: MarketConfidence
}) {
  return (
    <Badge tone={CONFIDENCE_TONE[confidence]}>
      {confidence === 'NONE'
        ? CONFIDENCE_LABELS.NONE
        : `Keyakinan ${CONFIDENCE_LABELS[confidence]}`}
    </Badge>
  )
}

/**
 * §39 — source, timestamp, confidence and methodology, shown together.
 *
 * When the data is synthetic this is deliberately loud. A demo number that
 * looks like a finding is worse than no number at all, because it can drive a
 * real purchase.
 */
export function ProvenanceNotice({
  provenance,
  className,
}: {
  provenance: Provenance
  className?: string
}) {
  const synthetic = provenance.source === 'DEMO'

  return (
    <div
      className={cn(
        'rounded-lg border px-4 py-3',
        synthetic
          ? 'border-dashed border-warning/40 bg-warning-muted/25'
          : 'border-border bg-surface',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span
          className={cn(
            'flex size-8 shrink-0 items-center justify-center rounded-md',
            synthetic
              ? 'bg-warning/15 text-warning'
              : 'bg-success-muted text-success',
          )}
        >
          {synthetic ? (
            <FlaskConical className="size-4" aria-hidden />
          ) : (
            <ShieldCheck className="size-4" aria-hidden />
          )}
        </span>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-fg">
            {synthetic ? 'Data ilustrasi — bukan data pasar nyata' : 'Data dari catatan Anda'}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-fg-muted">
            {provenance.methodology}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-fg-subtle">
            <span>Diperbarui {formatDate(provenance.retrievedAt)}</span>
            {provenance.sampleSize !== null && (
              <span>{provenance.sampleSize} observasi</span>
            )}
          </p>
        </div>
      </div>
    </div>
  )
}

/** Compact inline marker for a synthetic figure inside a dense list. */
export function SyntheticMark({ provenance }: { provenance: Provenance }) {
  if (provenance.source !== 'DEMO') return null
  return (
    <span
      title="Data ilustrasi"
      className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-warning"
    >
      <FlaskConical className="size-3" aria-hidden />
      Ilustrasi
    </span>
  )
}

export function MissingSignals({ signals }: { signals: string[] }) {
  if (signals.length === 0) return null
  return (
    <p className="flex items-start gap-1.5 text-xs leading-relaxed text-fg-subtle">
      <Info className="mt-0.5 size-3 shrink-0" aria-hidden />
      <span>Tidak tersedia: {signals.join(', ')}.</span>
    </p>
  )
}
