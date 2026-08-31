import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { cookies } from 'next/headers'
import { cache } from 'react'
import { prisma } from '@/lib/prisma'

export const SESSION_COOKIE = 'motoflip_session'
const SESSION_TTL_DAYS = 30

/**
 * Sessions are opaque random tokens stored HASHED in the database, so a leaked
 * database dump cannot be replayed as a login. The cookie is HttpOnly, so page
 * scripts can never read it.
 */
const hashToken = (token: string) =>
  createHash('sha256').update(token).digest('hex')

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ipAddress?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString('base64url')
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 86_400_000)

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent ?? null,
      ipAddress: meta.ipAddress ?? null,
    },
  })

  const store = await cookies()
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export interface SessionUser {
  id: string
  email: string
  name: string
}

/**
 * Resolve the current user, or null.
 *
 * Wrapped in React's `cache` so the many server components that need the user
 * within one render share a single database round-trip.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value
  if (!token) return null

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { id: true, email: true, name: true } } },
  })

  if (!session) return null
  if (session.revokedAt !== null) return null
  if (session.expiresAt.getTime() < Date.now()) return null

  return session.user
})

export async function destroySession(): Promise<void> {
  const store = await cookies()
  const token = store.get(SESSION_COOKIE)?.value

  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    })
  }

  store.delete(SESSION_COOKIE)
}
