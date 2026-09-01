import { requireUser } from '@/server/auth'
import { prisma } from '@/lib/prisma'
import { PageHeader } from '@/components/motoflip/page-header'
import { CategoryManager } from './manager'

export const metadata = { title: 'Kategori · motoflip' }
export const dynamic = 'force-dynamic'

export default async function CategoryPage() {
  const user = await requireUser()
  const categories = await prisma.category.findMany({
    where: { userId: user.id },
    orderBy: [{ archivedAt: 'asc' }, { kind: 'asc' }, { sortOrder: 'asc' }],
  })

  return (
    <>
      <PageHeader
        title="Kategori"
        subtitle="Klasifikasi pemasukan dan pengeluaran"
        backHref="/lainnya"
      />
      <CategoryManager
        categories={categories.map((c) => ({
          id: c.id,
          name: c.name,
          kind: c.kind,
          group: c.group,
          role: c.role,
          isSystem: c.isSystem,
          archived: c.archivedAt !== null,
        }))}
      />
    </>
  )
}
