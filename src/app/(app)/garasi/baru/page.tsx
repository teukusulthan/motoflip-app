import { requireUser } from '@/server/auth'
import { PageHeader } from '@/components/motoflip/page-header'
import { NewMotorcycleForm } from './form'

export const metadata = { title: 'Tambah Motor · motoflip' }

export default async function NewMotorcyclePage() {
  await requireUser()

  return (
    <>
      <PageHeader
        title="Tambah Motor"
        subtitle="Isi yang penting dulu — sisanya bisa dilengkapi nanti."
        backHref="/garasi"
      />
      <NewMotorcycleForm />
    </>
  )
}
