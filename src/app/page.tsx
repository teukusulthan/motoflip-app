import { redirect } from 'next/navigation'
import { getSessionUser } from '@/server/session'

export default async function RootPage() {
  const user = await getSessionUser()
  redirect(user ? '/beranda' : '/masuk')
}
