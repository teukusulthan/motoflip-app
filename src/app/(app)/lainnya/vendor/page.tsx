import { requireUser } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/motoflip/page-header'
import { VendorManager } from './manager'

export const metadata = { title: 'Vendor · motoflip' }
export const dynamic = 'force-dynamic'

export default async function VendorPage() {
  const user = await requireUser()
  const vendors = await prisma.vendor.findMany({
    where: { userId: user.id },
    orderBy: [{ archivedAt: 'asc' }, { name: 'asc' }],
  })

  return (
    <>
      <PageHeader
        title="Vendor"
        subtitle="Bengkel, biro jasa, dan pemasok"
        backHref="/lainnya"
      />
      <VendorManager
        vendors={vendors.map((v) => ({
          id: v.id,
          name: v.name,
          category: v.category,
          phone: v.phone,
          address: v.address,
          notes: v.notes,
          archived: v.archivedAt !== null,
        }))}
      />
    </>
  )
}
