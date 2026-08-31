import { readFile, rm } from 'node:fs/promises'
import path from 'node:path'
import { afterAll, describe, expect, it } from 'vitest'
import { cloudinaryConfigured, removeFile, storeFile } from './storage'

/** A genuine 1x1 PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const written: string[] = []

afterAll(async () => {
  await Promise.all(written.map((id) => removeFile(id)))
})

describe('storeFile() — local disk fallback', () => {
  it('falls back to disk when Cloudinary is not configured', () => {
    // The fallback is what makes a fresh clone usable with no credentials.
    expect(cloudinaryConfigured()).toBe(false)
  })

  it('writes the file and returns a servable URL', async () => {
    const stored = await storeFile(PNG, 'image/png', 'photos')
    written.push(stored.publicId)

    expect(stored.publicId).toMatch(/^local:photos\//)
    expect(stored.url).toMatch(/^\/uploads\/photos\/.+\.png$/)
    expect(stored.bytes).toBe(PNG.length)

    const onDisk = await readFile(
      path.join(process.cwd(), 'public', stored.url),
    )
    expect(onDisk.equals(PNG)).toBe(true)
  })

  it('gives every upload a distinct name so files never overwrite each other', async () => {
    const a = await storeFile(PNG, 'image/png', 'photos')
    const b = await storeFile(PNG, 'image/png', 'photos')
    written.push(a.publicId, b.publicId)
    expect(a.url).not.toBe(b.url)
  })
})

describe('removeFile()', () => {
  it('deletes a locally stored file', async () => {
    const stored = await storeFile(PNG, 'image/png', 'photos')
    const absolute = path.join(process.cwd(), 'public', stored.url)

    await expect(readFile(absolute)).resolves.toBeDefined()
    await removeFile(stored.publicId)
    await expect(readFile(absolute)).rejects.toThrow()
  })

  it('refuses to escape the uploads directory via a traversal id', async () => {
    const canary = path.join(process.cwd(), 'public', 'uploads', 'canary.txt')
    await import('node:fs/promises').then((fs) =>
      fs.writeFile(canary, 'do not delete'),
    )

    // A stored id crafted to climb out of public/uploads must be ignored.
    await removeFile('local:../../package.json')
    await expect(
      readFile(path.join(process.cwd(), 'package.json')),
    ).resolves.toBeDefined()

    await rm(canary, { force: true })
  })

  it('is a no-op for a Cloudinary id when Cloudinary is unconfigured', async () => {
    await expect(removeFile('motorflip/photos/abc123')).resolves.toBeUndefined()
  })
})
