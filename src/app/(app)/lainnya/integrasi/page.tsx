import { Plug } from 'lucide-react'
import { requireUser } from '@/server/auth'
import {
  anthropicConfigured,
  composioConfigured,
} from '@/server/composio/client'
import { listConnections } from '@/server/composio/toolkits'
import { Card, CardContent } from '@/components/ui/card'
import { PageHeader, SectionHeader } from '@/components/motoflip/page-header'
import { IntegrationManager } from './manager'

export const metadata = { title: 'Integrasi · motoflip' }
export const dynamic = 'force-dynamic'

/** Toolkits worth surfacing first for this business. */
const SUGGESTED = [
  { slug: 'gmail', name: 'Gmail', hint: 'Baca email penawaran & negosiasi' },
  { slug: 'googlesheets', name: 'Google Sheets', hint: 'Ekspor laporan & rekap' },
  { slug: 'googledrive', name: 'Google Drive', hint: 'Arsip dokumen kendaraan' },
  { slug: 'googlecalendar', name: 'Google Calendar', hint: 'Jadwal COD & servis' },
  { slug: 'whatsapp', name: 'WhatsApp', hint: 'Komunikasi pembeli' },
  { slug: 'notion', name: 'Notion', hint: 'Catatan & riset pasar' },
  { slug: 'slack', name: 'Slack', hint: 'Notifikasi tim' },
  { slug: 'github', name: 'GitHub', hint: 'Untuk pengembangan aplikasi ini' },
]

export default async function IntegrationsPage() {
  const user = await requireUser()

  const configured = composioConfigured()
  const hasAnthropic = anthropicConfigured()

  let connections: Awaited<ReturnType<typeof listConnections>> = []
  let loadError: string | null = null

  if (configured) {
    try {
      connections = await listConnections(user.id)
    } catch (error) {
      console.error('failed to load composio connections', error)
      loadError = 'Gagal memuat koneksi dari Composio.'
    }
  }

  return (
    <>
      <PageHeader
        title="Integrasi"
        subtitle="Hubungkan aplikasi lain lewat Composio"
        backHref="/lainnya"
      />

      {!configured && (
        <Card className="mb-5 border-dashed border-warning/40">
          <CardContent className="flex items-start gap-3">
            <Plug className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-fg">
                Composio belum dikonfigurasi
              </p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                Tambahkan <code className="text-fg">COMPOSIO_API_KEY</code> ke
                berkas <code className="text-fg">.env</code>, lalu mulai ulang
                server.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {configured && !hasAnthropic && (
        <Card className="mb-5 border-dashed border-warning/40">
          <CardContent className="flex items-start gap-3">
            <Plug className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
            <div>
              <p className="text-sm font-semibold text-fg">
                ANTHROPIC_API_KEY belum diatur
              </p>
              <p className="mt-1 text-xs leading-relaxed text-fg-muted">
                Koneksi aplikasi tetap bisa dibuat, tetapi asisten tidak dapat
                menjalankan tool tanpa kunci Anthropic.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {loadError && (
        <Card className="mb-5 border-danger/40">
          <CardContent>
            <p className="text-sm text-danger">{loadError}</p>
          </CardContent>
        </Card>
      )}

      <section>
        <SectionHeader title="Cara kerja" />
        <Card>
          <CardContent>
            <ol className="space-y-2 text-sm leading-relaxed text-fg-muted">
              <li>
                <span className="font-semibold text-fg">1.</span> Hubungkan
                aplikasi di bawah — Anda akan diarahkan ke halaman izin aplikasi
                tersebut.
              </li>
              <li>
                <span className="font-semibold text-fg">2.</span> Kredensial
                disimpan oleh Composio, bukan oleh motoflip.
              </li>
              <li>
                <span className="font-semibold text-fg">3.</span> Asisten hanya
                dapat memakai aplikasi yang Anda hubungkan sendiri.
              </li>
            </ol>
          </CardContent>
        </Card>
      </section>

      <div className="mt-6">
        <IntegrationManager
          enabled={configured}
          suggested={SUGGESTED}
          initialConnections={connections.map((account) => ({
            id: account.id,
            toolkit: account.toolkit?.slug ?? 'unknown',
            status: String(account.status ?? ''),
          }))}
        />
      </div>
    </>
  )
}
