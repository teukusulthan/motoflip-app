import type { MotorcycleStatus } from '@prisma/client'
import { Badge } from '@/components/ui/badge'
import type { BadgeProps } from '@/components/ui/badge'

export const STATUS_LABELS: Record<MotorcycleStatus, string> = {
  LEAD: 'Prospek',
  PURCHASING: 'Proses Beli',
  OWNED: 'Dimiliki',
  PREPARATION: 'Persiapan',
  READY_TO_SELL: 'Siap Jual',
  LISTED: 'Diiklankan',
  NEGOTIATION: 'Negosiasi',
  SOLD: 'Terjual',
  ARCHIVED: 'Arsip',
}

const STATUS_TONE: Record<MotorcycleStatus, NonNullable<BadgeProps['tone']>> = {
  LEAD: 'neutral',
  PURCHASING: 'info',
  OWNED: 'info',
  PREPARATION: 'warning',
  READY_TO_SELL: 'accent',
  LISTED: 'accent',
  NEGOTIATION: 'warning',
  SOLD: 'success',
  ARCHIVED: 'neutral',
}

/** The lifecycle order of §5, used by the status picker. */
export const STATUS_ORDER: MotorcycleStatus[] = [
  'LEAD',
  'PURCHASING',
  'OWNED',
  'PREPARATION',
  'READY_TO_SELL',
  'LISTED',
  'NEGOTIATION',
  'SOLD',
  'ARCHIVED',
]

export function StatusBadge({ status }: { status: MotorcycleStatus }) {
  return <Badge tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</Badge>
}
