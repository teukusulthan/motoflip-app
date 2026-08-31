import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * §42 — every empty state explains what this screen is for and offers the
 * action that fills it. Never a bare "No data".
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  actionHref,
}: {
  icon: LucideIcon
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
}) {
  return (
    <div className="flex flex-col items-center rounded-lg border border-dashed border-border bg-surface/50 px-6 py-12 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-elevated">
        <Icon className="size-5 text-fg-subtle" aria-hidden />
      </div>
      <h3 className="text-base font-semibold text-fg">{title}</h3>
      <p className="mt-1.5 max-w-[38ch] text-sm leading-relaxed text-fg-muted">
        {description}
      </p>
      {actionLabel && actionHref && (
        <Button asChild className="mt-6">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      )}
    </div>
  )
}
