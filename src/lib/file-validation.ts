/**
 * Upload validation — §45.
 *
 * Pure and dependency-free so it can be tested directly. The declared MIME type
 * on a browser upload is client-controlled and therefore only a hint; the
 * magic-number check is what actually decides whether a file is what it claims.
 */

export const MAX_PHOTO_BYTES = 10 * 1024 * 1024
export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

export const PHOTO_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
] as const

export const DOCUMENT_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const

export class UploadError extends Error {}

export const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heif',
  'application/pdf': 'pdf',
}

/** Identify a file from its leading bytes, or null if unrecognised. */
export function sniffMimeType(buffer: Uint8Array): string | null {
  if (buffer.length < 12) return null

  const ascii = (start: number, end: number) =>
    String.fromCharCode(...buffer.subarray(start, end))

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (buffer[0] === 0x89 && ascii(1, 4) === 'PNG') {
    return 'image/png'
  }
  if (ascii(0, 4) === '%PDF') {
    return 'application/pdf'
  }
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') {
    return 'image/webp'
  }
  // ISO-BMFF container: HEIC/HEIF declare their brand at offset 8.
  if (ascii(4, 8) === 'ftyp') {
    const brand = ascii(8, 12)
    if (['heic', 'heix', 'hevc', 'mif1', 'msf1', 'heim'].includes(brand)) {
      return 'image/heic'
    }
  }
  return null
}

/**
 * Check size, declared type, and actual content.
 *
 * Throws UploadError with a message safe to show the user (§43).
 */
export function assertValidUpload(
  buffer: Uint8Array,
  declaredType: string,
  allowed: readonly string[],
  maxBytes: number,
): void {
  if (buffer.length === 0) {
    throw new UploadError('Berkas kosong.')
  }
  if (buffer.length > maxBytes) {
    throw new UploadError(
      `Ukuran berkas melebihi ${Math.round(maxBytes / 1024 / 1024)} MB.`,
    )
  }
  if (!allowed.includes(declaredType)) {
    throw new UploadError('Jenis berkas tidak didukung.')
  }

  const sniffed = sniffMimeType(buffer)
  if (sniffed === null) {
    throw new UploadError('Isi berkas tidak dikenali.')
  }

  // HEIC and HEIF share a container; treat them as equivalent.
  const normalise = (type: string) => (type === 'image/heif' ? 'image/heic' : type)

  if (!allowed.map(normalise).includes(normalise(sniffed))) {
    throw new UploadError(
      'Isi berkas tidak cocok dengan jenisnya. Unggah berkas asli, bukan yang diganti namanya.',
    )
  }
}
