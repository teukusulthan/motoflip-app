import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import './globals.css'

export const metadata: Metadata = {
  title: 'motoflip',
  description: 'Sistem operasi bisnis untuk usaha jual-beli motor',
  applicationName: 'motoflip',
}

export const viewport: Viewport = {
  themeColor: '#090A0B',
  width: 'device-width',
  initialScale: 1,
  // Allow zoom — §41 accessibility. Never lock user scaling.
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="id" className="dark">
      <body className="min-h-dvh bg-bg">
        {children}
        <Toaster
          position="top-center"
          theme="dark"
          richColors
          toastOptions={{ className: 'font-sans' }}
        />
      </body>
    </html>
  )
}
