import { requireUser } from '@/server/auth'
import { PageHeader } from '@/components/motorflip/page-header'
import { NewMotorcycleForm } from './form'

export const metadata = { title: 'Tambah Motor · MotorFlip' }

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
