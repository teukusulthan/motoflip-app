import 'server-only'
import { redirect } from 'next/navigation'
import { type SessionUser, getSessionUser } from './session'

/**
 * Authorization gate for server components and server actions — §45.
 *
 * Every data-reading and data-writing path calls this. Authorization is never
 * left to the client, and never to route-level middleware alone.
 */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser()
  if (!user) redirect('/masuk')
  return user
}

/** For server actions, which should fail loudly rather than redirect. */
export async function requireUserId(): Promise<string> {
  const user = await getSessionUser()
  if (!user) {
    throw new Error('UNAUTHENTICATED')
  }
  return user.id
}
