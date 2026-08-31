import { describe, expect, it } from 'vitest'
import {
  DOCUMENT_MIME_TYPES,
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
  UploadError,
  assertValidUpload,
  sniffMimeType,
} from './file-validation'

/** Build a buffer with real magic bytes followed by filler. */
const withHeader = (bytes: number[], length = 64): Uint8Array => {
  const buffer = new Uint8Array(length)
  buffer.set(bytes, 0)
  return buffer
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))

const JPEG = withHeader([0xff, 0xd8, 0xff, 0xe0])
const PNG = withHeader([0x89, ...ascii('PNG'), 0x0d, 0x0a, 0x1a, 0x0a])
const PDF = withHeader(ascii('%PDF-1.7'))
const WEBP = withHeader([...ascii('RIFF'), 0, 0, 0, 0, ...ascii('WEBP')])
const HEIC = withHeader([0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('heic')])

describe('sniffMimeType()', () => {
  it('recognises the formats the app accepts', () => {
    expect(sniffMimeType(JPEG)).toBe('image/jpeg')
    expect(sniffMimeType(PNG)).toBe('image/png')
    expect(sniffMimeType(PDF)).toBe('application/pdf')
    expect(sniffMimeType(WEBP)).toBe('image/webp')
    expect(sniffMimeType(HEIC)).toBe('image/heic')
  })

  it('returns null for unrecognised content', () => {
    expect(sniffMimeType(withHeader(ascii('<?php system($_GET[0]);')))).toBeNull()
    expect(sniffMimeType(withHeader([0x4d, 0x5a]))).toBeNull() // Windows PE
  })

  it('returns null for a buffer too short to identify', () => {
    expect(sniffMimeType(new Uint8Array([0xff, 0xd8]))).toBeNull()
  })

  it('does not mistake a non-image ISO-BMFF brand for HEIC', () => {
    const mp4 = withHeader([0, 0, 0, 0x18, ...ascii('ftyp'), ...ascii('mp42')])
    expect(sniffMimeType(mp4)).toBeNull()
  })
})

describe('assertValidUpload()', () => {
  it('accepts a genuine photo', () => {
    expect(() =>
      assertValidUpload(JPEG, 'image/jpeg', PHOTO_MIME_TYPES, MAX_PHOTO_BYTES),
    ).not.toThrow()
  })

  it('accepts a genuine PDF as a document', () => {
    expect(() =>
      assertValidUpload(PDF, 'application/pdf', DOCUMENT_MIME_TYPES, MAX_PHOTO_BYTES),
    ).not.toThrow()
  })

  it('rejects an empty file', () => {
    expect(() =>
      assertValidUpload(new Uint8Array(0), 'image/jpeg', PHOTO_MIME_TYPES, MAX_PHOTO_BYTES),
    ).toThrow(UploadError)
  })

  it('rejects a file over the size limit', () => {
    const big = new Uint8Array(MAX_PHOTO_BYTES + 1)
    big.set([0xff, 0xd8, 0xff, 0xe0], 0)
    expect(() =>
      assertValidUpload(big, 'image/jpeg', PHOTO_MIME_TYPES, MAX_PHOTO_BYTES),
    ).toThrow(/melebihi/)
  })

  it('rejects a disallowed declared type', () => {
    expect(() =>
      assertValidUpload(PDF, 'application/pdf', PHOTO_MIME_TYPES, MAX_PHOTO_BYTES),
    ).toThrow(/tidak didukung/)
  })

  it('rejects a script renamed to look like an image', () => {
    // The attack this exists to stop: declare image/jpeg, send executable text.
    const script = withHeader(ascii('#!/bin/sh\nrm -rf /'))
    expect(() =>
      assertValidUpload(script, 'image/jpeg', PHOTO_MIME_TYPES, MAX_PHOTO_BYTES),
    ).toThrow(/tidak dikenali/)
  })

  it('rejects a PDF declared as a JPEG', () => {
    expect(() =>
      assertValidUpload(PDF, 'image/jpeg', PHOTO_MIME_TYPES, MAX_PHOTO_BYTES),
    ).toThrow(/tidak cocok/)
  })

  it('treats HEIF and HEIC as the same container', () => {
    expect(() =>
      assertValidUpload(HEIC, 'image/heif', PHOTO_MIME_TYPES, MAX_PHOTO_BYTES),
    ).not.toThrow()
  })
})
