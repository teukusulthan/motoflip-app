import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'

/**
 * Compact screen header — §32 warns against huge headers eating the viewport
 * on a phone, so this stays to one line plus an optional subtitle.
 */
export function PageHeader({
  title,
  subtitle,
  backHref,
  action,
}: {
  title: string
  subtitle?: string
  backHref?: string
  action?: React.ReactNode
}) {
  return (
    <header className="flex items-start gap-3 pb-4 pt-5">
      {backHref && (
        <Link
          href={backHref}
          aria-label="Kembali"
          className="-ml-2 flex size-11 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-elevated hover:text-fg"
        >
          <ChevronLeft className="size-5" aria-hidden />
        </Link>
      )}
      <div className="min-w-0 flex-1">
        <h1 className="truncate text-xl font-bold tracking-tight text-fg">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 truncate text-sm text-fg-muted">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  )
}

export function SectionHeader({
  title,
  action,
}: {
  title: string
  action?: React.ReactNode
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
        {title}
      </h2>
      {action}
    </div>
  )
}
