'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check, ExternalLink, Loader2, Plug, Unplug } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { SectionHeader } from '@/components/motoflip/page-header'

export interface SuggestedToolkit {
  slug: string
  name: string
  hint: string
}

export interface ConnectionRow {
  id: string
  toolkit: string
  status: string
}

export function IntegrationManager({
  enabled,
  suggested,
  initialConnections,
}: {
  enabled: boolean
  suggested: SuggestedToolkit[]
  initialConnections: ConnectionRow[]
}) {
  const router = useRouter()
  const [pending, setPending] = React.useState<string | null>(null)
  const [custom, setCustom] = React.useState('')

  const connectedSlugs = new Set(initialConnections.map((c) => c.toolkit))

  async function connect(slug: string) {
    setPending(slug)
    try {
      const response = await fetch('/api/composio/connections', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolkit: slug }),
      })
      const data = await response.json()

      if (!response.ok) {
        toast.error(data.error ?? 'Gagal memulai koneksi.')
        return
      }
      if (!data.redirectUrl) {
        toast.success('Koneksi dibuat.')
        router.refresh()
        return
      }

      // Opened in a new tab so the operator does not lose this page.
      window.open(data.redirectUrl, '_blank', 'noopener,noreferrer')
      toast.info('Selesaikan otorisasi di tab baru, lalu muat ulang halaman.')
    } catch {
      toast.error('Gagal menghubungi server.')
    } finally {
      setPending(null)
    }
  }

  async function disconnect(id: string, slug: string) {
    setPending(slug)
    try {
      const response = await fetch('/api/composio/connections', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connectedAccountId: id }),
      })
      const data = await response.json()
      if (!response.ok) {
        toast.error(data.error ?? 'Gagal memutuskan koneksi.')
        return
      }
      toast.success('Koneksi diputus.')
      router.refresh()
    } catch {
      toast.error('Gagal menghubungi server.')
    } finally {
      setPending(null)
    }
  }

  return (
    <div className="space-y-6">
      {initialConnections.length > 0 && (
        <section>
          <SectionHeader title="Terhubung" />
          <Card>
            <ul className="divide-y divide-border">
              {initialConnections.map((connection) => (
                <li
                  key={connection.id}
                  className="flex items-center gap-3 px-4 py-3"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-success-muted text-success">
                    <Check className="size-4" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold capitalize text-fg">
                      {connection.toolkit}
                    </p>
                    <p className="truncate text-xs text-fg-subtle">
                      {connection.status || 'aktif'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={pending === connection.toolkit}
                    onClick={() => disconnect(connection.id, connection.toolkit)}
                    aria-label={`Putuskan ${connection.toolkit}`}
                    className="flex size-11 shrink-0 items-center justify-center rounded-md text-fg-subtle transition-colors hover:bg-danger-muted hover:text-danger disabled:opacity-50"
                  >
                    {pending === connection.toolkit ? (
                      <Loader2 className="size-4 animate-spin" aria-hidden />
                    ) : (
                      <Unplug className="size-4" aria-hidden />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </section>
      )}

      <section>
        <SectionHeader title="Aplikasi Tersedia" />
        <ul className="space-y-2">
          {suggested.map((toolkit) => {
            const connected = connectedSlugs.has(toolkit.slug)
            return (
              <li key={toolkit.slug}>
                <Card>
                  <CardContent className="flex items-center gap-3 py-3">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-elevated text-fg-muted">
                      <Plug className="size-4" aria-hidden />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-fg">
                        {toolkit.name}
                      </p>
                      <p className="truncate text-xs text-fg-muted">
                        {toolkit.hint}
                      </p>
                    </div>
                    {connected ? (
                      <Badge tone="success">Terhubung</Badge>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={!enabled || pending === toolkit.slug}
                        onClick={() => connect(toolkit.slug)}
                      >
                        {pending === toolkit.slug ? (
                          <Loader2 className="size-4 animate-spin" aria-hidden />
                        ) : (
                          <ExternalLink className="size-4" aria-hidden />
                        )}
                        Hubungkan
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      <section>
        <SectionHeader title="Aplikasi Lain" />
        <Card>
          <CardContent className="space-y-3">
            <p className="text-xs leading-relaxed text-fg-muted">
              Composio mendukung ratusan aplikasi. Masukkan slug-nya (huruf
              kecil, misalnya <code className="text-fg">linear</code> atau{' '}
              <code className="text-fg">airtable</code>).
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="custom-toolkit">Slug Aplikasi</Label>
              <Input
                id="custom-toolkit"
                value={custom}
                onChange={(event) => setCustom(event.target.value.toLowerCase())}
                placeholder="linear"
                autoCapitalize="none"
                autoCorrect="off"
              />
            </div>
            <Button
              size="full"
              variant="secondary"
              disabled={!enabled || custom.trim() === '' || pending !== null}
              onClick={() => connect(custom.trim())}
            >
              {pending === custom.trim() ? 'Menghubungkan…' : 'Hubungkan'}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
