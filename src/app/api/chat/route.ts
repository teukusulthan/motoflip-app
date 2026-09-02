import { NextResponse } from 'next/server'
import { z } from 'zod'
import { getSessionUser } from '@/server/session'
import {
  ComposioNotConfiguredError,
  anthropicConfigured,
  composioConfigured,
} from '@/server/composio/client'
import { NoToolkitsConnectedError, runAgent } from '@/server/composio/agent'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const bodySchema = z.object({
  message: z.string().trim().min(1, 'Pesan tidak boleh kosong').max(4000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(20_000),
      }),
    )
    .max(20)
    .optional(),
})

export async function POST(request: Request) {
  // §45 — authenticated and authorised server-side, like every other route.
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi.' }, { status: 401 })
  }

  if (!composioConfigured() || !anthropicConfigured()) {
    return NextResponse.json(
      {
        error:
          'Integrasi belum dikonfigurasi. COMPOSIO_API_KEY dan ANTHROPIC_API_KEY diperlukan.',
      },
      { status: 503 },
    )
  }

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Body tidak valid.' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(payload)
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? 'Permintaan tidak valid.' },
      { status: 400 },
    )
  }

  try {
    const result = await runAgent(
      user.id,
      parsed.data.message,
      parsed.data.history ?? [],
    )
    return NextResponse.json(result)
  } catch (error) {
    if (error instanceof NoToolkitsConnectedError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    if (error instanceof ComposioNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 })
    }

    // Never leak provider internals or key material to the client (§45).
    console.error('composio agent failed', error)
    return NextResponse.json(
      { error: 'Asisten gagal merespons. Silakan coba lagi.' },
      { status: 500 },
    )
  }
}
