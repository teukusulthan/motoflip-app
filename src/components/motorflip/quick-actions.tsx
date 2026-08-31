'use client'

import * as React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Drawer } from 'vaul'
import {
  Bike,
  Calculator,
  Camera,
  Home,
  Layers,
  MoreHorizontal,
  Plus,
  TrendingDown,
  TrendingUp,
  Store,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/beranda', label: 'Beranda', icon: Home },
  { href: '/garasi', label: 'Garasi', icon: Layers },
  { href: '/pasar', label: 'Pasar', icon: Store },
  { href: '/lainnya', label: 'Lainnya', icon: MoreHorizontal },
] as const

const QUICK_ACTIONS = [
  {
    href: '/garasi/baru',
    label: 'Tambah Motor',
    hint: 'Catat pembelian motor baru',
    icon: Bike,
  },
  {
    href: '/transaksi/pengeluaran',
    label: 'Tambah Pengeluaran',
    hint: 'Servis, sparepart, dokumen',
    icon: TrendingDown,
  },
  {
    href: '/transaksi/pemasukan',
    label: 'Tambah Pemasukan',
    hint: 'Penjualan atau pendapatan lain',
    icon: TrendingUp,
  },
  {
    href: '/garasi?foto=1',
    label: 'Tambah Foto',
    hint: 'Unggah foto ke galeri motor',
    icon: Camera,
  },
  {
    href: '/analisa-deal',
    label: 'Analisa Deal',
    hint: 'Hitung proyeksi profit & skor',
    icon: Calculator,
  },
] as const

/**
 * Bottom navigation — §3.
 *
 * Five slots with the primary action in the centre, which is the easiest place
 * to reach one-handed. Every target is at least 44px (§32).
 */
export function BottomNav() {
  const pathname = usePathname()
  const [open, setOpen] = React.useState(false)

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  return (
    <>
      <nav
        aria-label="Navigasi utama"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface/95 backdrop-blur-lg lg:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <ul className="mx-auto grid max-w-app grid-cols-5">
          {NAV.slice(0, 2).map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}

          <li className="flex items-center justify-center">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Aksi cepat"
              className="-mt-5 flex size-14 items-center justify-center rounded-full bg-accent text-accent-fg shadow-lg shadow-accent/20 transition-transform active:scale-95"
            >
              <Plus className="size-6" strokeWidth={2.5} aria-hidden />
            </button>
          </li>

          {NAV.slice(2).map((item) => (
            <NavItem key={item.href} {...item} active={isActive(item.href)} />
          ))}
        </ul>
      </nav>

      <Drawer.Root open={open} onOpenChange={setOpen}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-black/60" />
          <Drawer.Content className="fixed inset-x-0 bottom-0 z-50 mt-24 rounded-t-2xl border-t border-border bg-surface outline-none">
            <div className="mx-auto w-full max-w-app px-4 pb-8 pt-3">
              <div
                aria-hidden
                className="mx-auto mb-4 h-1 w-10 rounded-full bg-border"
              />
              <Drawer.Title className="mb-1 text-base font-semibold text-fg">
                Aksi Cepat
              </Drawer.Title>
              <Drawer.Description className="mb-4 text-sm text-fg-muted">
                Pilih yang ingin Anda catat.
              </Drawer.Description>

              <ul className="space-y-2">
                {QUICK_ACTIONS.map((action) => (
                  <li key={action.href}>
                    <Link
                      href={action.href}
                      onClick={() => setOpen(false)}
                      className="flex min-h-tap items-center gap-3 rounded-md border border-border bg-elevated px-3 py-3 transition-colors active:bg-accent/10"
                    >
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/12 text-accent">
                        <action.icon className="size-5" aria-hidden />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold text-fg">
                          {action.label}
                        </span>
                        <span className="block truncate text-xs text-fg-muted">
                          {action.hint}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    </>
  )
}

function NavItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string
  label: string
  icon: typeof Home
  active: boolean
}) {
  return (
    <li>
      <Link
        href={href}
        aria-current={active ? 'page' : undefined}
        className={cn(
          'flex h-nav flex-col items-center justify-center gap-1 text-[10px] font-semibold transition-colors',
          active ? 'text-accent' : 'text-fg-subtle hover:text-fg-muted',
        )}
      >
        <Icon className="size-5" aria-hidden />
        {label}
      </Link>
    </li>
  )
}

/** Desktop sidebar — §33. Same routes, richer layout at ≥1024px. */
export function Sidebar() {
  const pathname = usePathname()
  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`)

  const items = [
    { href: '/beranda', label: 'Beranda', icon: Home },
    { href: '/garasi', label: 'Garasi', icon: Layers },
    { href: '/analitik', label: 'Analitik', icon: TrendingUp },
    { href: '/analisa-deal', label: 'Analisa Deal', icon: Calculator },
    { href: '/pasar', label: 'Pasar', icon: Store },
    { href: '/lainnya', label: 'Lainnya', icon: MoreHorizontal },
  ]

  return (
    <aside className="fixed inset-y-0 left-0 hidden w-60 shrink-0 border-r border-border bg-surface px-3 py-5 lg:block">
      <Link href="/beranda" className="mb-6 flex items-center gap-2 px-2">
        <span className="flex size-8 items-center justify-center rounded-md bg-accent text-accent-fg">
          <Bike className="size-5" aria-hidden />
        </span>
        <span className="text-base font-bold tracking-tight text-fg">
          MotorFlip
        </span>
      </Link>

      <nav aria-label="Navigasi samping">
        <ul className="space-y-1">
          {items.map((item) => (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={isActive(item.href) ? 'page' : undefined}
                className={cn(
                  'flex min-h-tap items-center gap-3 rounded-md px-3 text-sm font-medium transition-colors',
                  isActive(item.href)
                    ? 'bg-accent/12 text-accent'
                    : 'text-fg-muted hover:bg-elevated hover:text-fg',
                )}
              >
                <item.icon className="size-4" aria-hidden />
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <Link
        href="/garasi/baru"
        className="mt-6 flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-fg transition-colors hover:bg-accent/90"
      >
        <Plus className="size-4" aria-hidden />
        Tambah Motor
      </Link>
    </aside>
  )
}
