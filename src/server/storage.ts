import 'server-only'
import { randomUUID } from 'node:crypto'
import { mkdir, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { EXTENSIONS, assertValidUpload } from '@/lib/file-validation'

/**
 * File storage behind a single interface — §36.
 *
 * Cloudinary is used when credentials are present, which gives §40's image
 * optimisation for free. Without credentials it falls back to local disk so the
 * app is fully usable on a fresh clone, and so that a missing env var is never
 * the reason a photo silently fails to save.
 */
export interface StoredFile {
  publicId: string
  url: string
  width: number | null
  height: number | null
  bytes: number
}

export {
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
  UploadError,
} from '@/lib/file-validation'

export const cloudinaryConfigured = (): boolean =>
  Boolean(
    process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET,
  )

/** Read a browser File and validate it before anything touches storage. */
export async function readValidatedUpload(
  file: File,
  allowed: readonly string[],
  maxBytes: number,
): Promise<Buffer> {
  const buffer = Buffer.from(await file.arrayBuffer())
  assertValidUpload(buffer, file.type, allowed, maxBytes)
  return buffer
}

export async function storeFile(
  buffer: Buffer,
  mimeType: string,
  folder: string,
): Promise<StoredFile> {
  return cloudinaryConfigured()
    ? storeOnCloudinary(buffer, mimeType, folder)
    : storeOnDisk(buffer, mimeType, folder)
}

async function storeOnCloudinary(
  buffer: Buffer,
  mimeType: string,
  folder: string,
): Promise<StoredFile> {
  const { v2: cloudinary } = await import('cloudinary')

  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  const isPdf = mimeType === 'application/pdf'

  const result = await new Promise<Record<string, unknown>>((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: `motoflip/${folder}`,
        resource_type: isPdf ? 'raw' : 'image',
        // Ownership papers must not be publicly guessable — §45.
        type: folder === 'documents' ? 'authenticated' : 'upload',
      },
      (error, uploaded) => {
        if (error || !uploaded) reject(error ?? new Error('Upload gagal'))
        else resolve(uploaded as unknown as Record<string, unknown>)
      },
    )
    stream.end(buffer)
  })

  return {
    publicId: String(result.public_id),
    url: String(result.secure_url),
    width: typeof result.width === 'number' ? result.width : null,
    height: typeof result.height === 'number' ? result.height : null,
    bytes: typeof result.bytes === 'number' ? result.bytes : buffer.length,
  }
}

/**
 * Local development fallback.
 *
 * Files land in public/uploads, which Next serves statically. This does NOT
 * survive an ephemeral or serverless deploy — configure Cloudinary before
 * putting real documents into production.
 */
async function storeOnDisk(
  buffer: Buffer,
  mimeType: string,
  folder: string,
): Promise<StoredFile> {
  const extension = EXTENSIONS[mimeType] ?? 'bin'
  const fileName = `${randomUUID()}.${extension}`
  const directory = path.join(process.cwd(), 'public', 'uploads', folder)

  await mkdir(directory, { recursive: true })
  await writeFile(path.join(directory, fileName), buffer)

  return {
    publicId: `local:${folder}/${fileName}`,
    url: `/uploads/${folder}/${fileName}`,
    width: null,
    height: null,
    bytes: buffer.length,
  }
}

/**
 * A URL that can actually be read.
 *
 * Documents are uploaded to Cloudinary with `authenticated` delivery, so the
 * secure_url returned at upload time is NOT directly fetchable — it needs a
 * signature. Local-disk files are served straight from /public.
 *
 * Returns null when the caller should stream the file itself.
 */
export async function readableUrl(
  publicId: string,
  storedUrl: string,
  mimeType: string,
): Promise<string | null> {
  if (publicId.startsWith('local:')) return storedUrl
  if (!cloudinaryConfigured()) return storedUrl

  const { v2: cloudinary } = await import('cloudinary')
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })

  return cloudinary.url(publicId, {
    type: 'authenticated',
    resource_type: mimeType === 'application/pdf' ? 'raw' : 'image',
    sign_url: true,
    secure: true,
  })
}

export async function removeFile(publicId: string): Promise<void> {
  if (publicId.startsWith('local:')) {
    const relative = publicId.slice('local:'.length)
    // Guard against a stored id escaping the uploads directory.
    const target = path.join(process.cwd(), 'public', 'uploads', relative)
    const root = path.join(process.cwd(), 'public', 'uploads')
    if (!path.resolve(target).startsWith(path.resolve(root))) return

    await unlink(target).catch(() => undefined)
    return
  }

  if (!cloudinaryConfigured()) return

  const { v2: cloudinary } = await import('cloudinary')
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  })
  await cloudinary.uploader.destroy(publicId).catch(() => undefined)
}
