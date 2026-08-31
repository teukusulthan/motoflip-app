import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scryptAsync = promisify(scrypt)

const KEY_LENGTH = 64
const SALT_LENGTH = 16

/**
 * Password hashing via scrypt from node:crypto.
 *
 * Chosen over bcrypt/argon2 to avoid a native build step: scrypt is a
 * memory-hard KDF built into Node, and the stored format carries its own salt.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LENGTH)
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer
  return `scrypt$${salt.toString('hex')}$${derived.toString('hex')}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false

  const [, saltHex, hashHex] = parts
  if (!saltHex || !hashHex) return false

  const salt = Buffer.from(saltHex, 'hex')
  const expected = Buffer.from(hashHex, 'hex')
  const derived = (await scryptAsync(password, salt, expected.length)) as Buffer

  // Length check first: timingSafeEqual throws on a length mismatch.
  if (derived.length !== expected.length) return false
  return timingSafeEqual(derived, expected)
}
