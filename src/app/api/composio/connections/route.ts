import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/server/session'
import {
  ComposioNotConfiguredError,
  composioConfigured,
} from '@/server/composio/client'
import {
  initiateConnection,
  listConnections,
  removeConnection,
} from '@/server/composio/toolkits'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

async function requireUser() {
  const user = await getSessionUser()
  if (!user) return null
  return user
}

/** Which apps this operator has authorised. */
export async function GET() {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  }
  if (!composioConfigured()) {
    return NextResponse.json({ configured: false, connections: [] })
  }

  try {
    const connections = await listConnections(user.id)
    return NextResponse.json({
      configured: true,
      connections: connections.map((account) => ({
        id: account.id,
        toolkit: account.toolkit?.slug ?? 'unknown',
        status: account.status,
        createdAt: account.createdAt ?? null,
      })),
    })
  } catch (error) {
    if (error instanceof ComposioNotConfiguredError) {
      return NextResponse.json({ configured: false, connections: [] })
    }
    console.error('composio list connections failed', error)
    return NextResponse.json(
      { error: 'Gagal memuat koneksi.' },
      { status: 500 },
    )
  }
}

const initiateSchema = z.object({
  toolkit: z
    .string()
    .trim()
    .min(1)
    .max(64)
    // Toolkit slugs are lowercase identifiers; reject anything else rather
    // than forwarding arbitrary strings to the provider.
    .regex(/^[a-z0-9_-]+$/, 'Slug aplikasi tidak valid'),
})

/** Start an OAuth flow; returns a URL for the operator to open. */
export async function POST(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const parsed = initiateSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Permintaan tidak valid.' },
      { status: 400 },
    )
  }

  try {
    const connection = await initiateConnection(user.id, parsed.data.toolkit)
    return NextResponse.json(connection)
  } catch (error) {
    if (error instanceof ComposioNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }
    console.error('composio initiate failed', error)
    return NextResponse.json(
      { error: 'Gagal memulai koneksi. Periksa nama aplikasi.' },
      { status: 500 },
    )
  }
}

const deleteSchema = z.object({ connectedAccountId: z.string().trim().min(1) })

export async function DELETE(request: Request) {
  const user = await requireUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const parsed = deleteSchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Permintaan tidak valid.' }, { status: 400 })
  }

  try {
    await removeConnection(user.id, parsed.data.connectedAccountId)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('composio delete failed', error)
    return NextResponse.json(
      { error: 'Gagal memutuskan koneksi.' },
      { status: 500 },
    )
  }
}
