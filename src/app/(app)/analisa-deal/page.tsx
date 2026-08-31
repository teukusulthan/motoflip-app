import { requireUser } from '@/server/auth'
import { getMotorcycles } from '@/data/garage'
import { PageHeader } from '@/components/motoflip/page-header'
import { DealAnalyzer } from './analyzer'
import { analyzeDeal } from './action'

export const metadata = { title: 'Analisa Deal · motoflip' }
export const dynamic = 'force-dynamic'

export default async function DealAnalyzerPage() {
  const user = await requireUser()
  const motorcycles = await getMotorcycles(user.id)

  const soldCount = motorcycles.filter((m) => m.status === 'SOLD').length

  return (
    <>
      <PageHeader
        title="Analisa Deal"
        subtitle="Hitung proyeksi sebelum Anda membeli"
        backHref="/beranda"
      />
      <DealAnalyzer action={analyzeDeal} historyCount={soldCount} />
    </>
  )
}
