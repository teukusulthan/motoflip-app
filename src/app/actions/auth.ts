'use server'

import { redirect } from 'next/navigation'
import { headers } from 'next/headers'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/server/password'
import { createSession, destroySession } from '@/server/session'
import type { ActionState } from '@/lib/validation'

const signInSchema = z.object({
  email: z.string().trim().min(1, 'Email wajib diisi').email('Format email tidak valid'),
  password: z.string().min(1, 'Kata sandi wajib diisi'),
})

export async function signIn(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const parsed = signInSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: 'Email dan kata sandi wajib diisi.' }
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
  })

  // Same message and comparable work whether or not the account exists, so the
  // response cannot be used to enumerate valid emails.
  const valid = user
    ? await verifyPassword(parsed.data.password, user.passwordHash)
    : await verifyPassword(parsed.data.password, 'scrypt$00$00')

  if (!user || !valid) {
    return { error: 'Email atau kata sandi salah.' }
  }

  const headerList = await headers()
  await createSession(user.id, {
    userAgent: headerList.get('user-agent'),
    ipAddress: headerList.get('x-forwarded-for'),
  })

  redirect('/beranda')
}

export async function signOut(): Promise<void> {
  await destroySession()
  redirect('/masuk')
}
