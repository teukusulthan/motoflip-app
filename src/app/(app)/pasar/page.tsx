import { Store } from 'lucide-react'
import { requireUser } from '@/server/auth'
import { PageHeader } from '@/components/motorflip/page-header'
import { Card, CardContent } from '@/components/ui/card'

export const metadata = { title: 'Pasar · MotorFlip' }

/**
 * §39 — market intelligence is not yet connected to any real data source.
 *
 * This screen states that plainly instead of showing mock trends, because a
 * fabricated demand curve is worse than an honest empty screen: it would look
 * exactly like a real signal and could drive a real purchase decision.
 */
export default async function MarketPage() {
  await requireUser()

  return (
    <>
      <PageHeader
        title="Pasar"
        subtitle="Intelijen pasar dan peluang pembelian"
      />

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center px-6 py-12 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-elevated">
            <Store className="size-5 text-fg-subtle" aria-hidden />
          </div>
          <h2 className="text-base font-semibold text-fg">
            Belum terhubung ke sumber data pasar.
          </h2>
          <p className="mt-2 max-w-[42ch] text-sm leading-relaxed text-fg-muted">
            Modul ini akan menampilkan tren permintaan, likuiditas, dan harga
            pasar per model dan tahun — tetapi hanya setelah terhubung ke sumber
            data nyata.
          </p>
          <p className="mt-4 max-w-[42ch] text-xs leading-relaxed text-fg-subtle">
            MotorFlip tidak menampilkan angka pasar buatan. Sampai penyedia data
            tersedia, gunakan Analisa Deal yang bekerja dari riwayat flipping
            Anda sendiri.
          </p>
        </CardContent>
      </Card>

      <section className="mt-6">
        <h3 className="mb-3 text-[11px] font-bold uppercase tracking-[0.1em] text-fg-subtle">
          Yang akan hadir
        </h3>
        <ul className="space-y-2">
          {[
            ['Tren permintaan', 'Indeks permintaan per model dan tahun produksi'],
            ['Likuiditas', 'Perkiraan kecepatan jual berdasarkan aktivitas listing'],
            ['Harga pasar', 'Rentang harga aktual di marketplace'],
            ['Skor peluang', 'Gabungan data pasar dan rekam jejak pribadi Anda'],
            ['Watchlist', 'Pantau model tertentu beserta perubahan trennya'],
          ].map(([title, detail]) => (
            <li
              key={title}
              className="rounded-md border border-border bg-surface px-4 py-3"
            >
              <p className="text-sm font-semibold text-fg">{title}</p>
              <p className="mt-0.5 text-xs text-fg-muted">{detail}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  )
}
