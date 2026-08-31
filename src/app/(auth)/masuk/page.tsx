import { redirect } from 'next/navigation'
import { Bike } from 'lucide-react'
import { getSessionUser } from '@/server/session'
import { SignInForm } from './sign-in-form'

export const metadata = { title: 'Masuk · MotorFlip' }

export default async function SignInPage() {
  if (await getSessionUser()) redirect('/beranda')

  return (
    <main className="flex min-h-dvh flex-col justify-center px-4 py-10">
      <div className="mx-auto w-full max-w-[400px]">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex size-12 items-center justify-center rounded-lg bg-accent text-accent-fg">
            <Bike className="size-6" aria-hidden />
          </span>
          <h1 className="text-2xl font-bold tracking-tight text-fg">
            MotorFlip
          </h1>
          <p className="mt-1 text-sm text-fg-muted">
            Sistem operasi bisnis jual-beli motor Anda.
          </p>
        </div>

        <SignInForm />
      </div>
    </main>
  )
}
