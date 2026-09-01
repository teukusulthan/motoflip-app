import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import path from 'node:path'
import { type NextRequest, NextResponse } from 'next/server'
import { Readable } from 'node:stream'
import { prisma } from '@/lib/prisma'
import { getSessionUser } from '@/server/session'
import { readableUrl } from '@/server/storage'

/**
 * Authorised document access — §45.
 *
 * Ownership papers (BPKB, STNK) must never be reachable by guessing a URL, so
 * access goes through this handler rather than a stored link: the session is
 * checked, the document is scoped to the owner, and only then is a short-lived
 * signed Cloudinary URL minted or the local file streamed.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Tidak diizinkan.' }, { status: 401 })
  }

  const { id } = await params
  const document = await prisma.document.findFirst({
    where: { id, userId: user.id, deletedAt: null },
  })
  if (!document) {
    return NextResponse.json({ error: 'Dokumen tidak ditemukan.' }, { status: 404 })
  }

  const target = await readableUrl(
    document.publicId,
    document.url,
    document.mimeType,
  )

  if (target && !document.publicId.startsWith('local:')) {
    return NextResponse.redirect(target)
  }

  // Local development: stream from disk so the file is never served by a
  // guessable static path either.
  const relative = document.publicId.replace(/^local:/, '')
  const root = path.join(process.cwd(), 'public', 'uploads')
  const absolute = path.join(root, relative)

  if (!path.resolve(absolute).startsWith(path.resolve(root))) {
    return NextResponse.json({ error: 'Jalur tidak valid.' }, { status: 400 })
  }

  try {
    const info = await stat(absolute)
    const stream = Readable.toWeb(
      createReadStream(absolute),
    ) as unknown as ReadableStream

    return new NextResponse(stream, {
      headers: {
        'Content-Type': document.mimeType,
        'Content-Length': String(info.size),
        'Content-Disposition': `inline; filename="${encodeURIComponent(document.fileName)}"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch {
    return NextResponse.json({ error: 'Berkas tidak ditemukan.' }, { status: 404 })
  }
}
