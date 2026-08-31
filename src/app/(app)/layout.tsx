import { requireUser } from '@/server/auth'
import { BottomNav, Sidebar } from '@/components/motoflip/quick-actions'

/**
 * Authenticated shell.
 *
 * §45 — authorization happens here on the server, so every nested route is
 * protected by construction rather than by remembering to add a check.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  await requireUser()

  return (
    <div className="min-h-dvh lg:pl-60">
      <Sidebar />
      <main className="app-shell pb-nav-safe lg:pb-10">{children}</main>
      <BottomNav />
    </div>
  )
}
