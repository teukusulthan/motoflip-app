import { notFound } from 'next/navigation'
import { requireUser } from '@/server/auth'
import { getMotorcycle } from '@/data/garage'
import { PageHeader } from '@/components/motoflip/page-header'
import { EditMotorcycleForm } from './form'

export const metadata = { title: 'Ubah Motor · motoflip' }
export const dynamic = 'force-dynamic'

export default async function EditMotorcyclePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const user = await requireUser()
  const { id } = await params

  const row = await getMotorcycle(user.id, id)
  if (!row) notFound()

  return (
    <>
      <PageHeader
        title="Ubah Motor"
        subtitle={[row.brand, row.model, row.year].filter(Boolean).join(' ')}
        backHref={`/garasi/${row.id}`}
      />
      <EditMotorcycleForm
        motorcycle={{
          id: row.id,
          brand: row.brand,
          model: row.model,
          variant: row.variant,
          year: row.year,
          color: row.color,
          mileage: row.mileage,
          plateNumber: row.plateNumber,
          engineNumber: row.engineNumber,
          frameNumber: row.frameNumber,
          location: row.location,
          sellerName: row.sellerName,
          sellerContact: row.sellerContact,
          notes: row.notes,
          acquisitionSource: row.acquisitionSource,
          projectedRepairCost: row.projectedRepairCost?.toString() ?? '',
          targetSellingPrice: row.targetSellingPrice?.toString() ?? '',
        }}
      />
    </>
  )
}
