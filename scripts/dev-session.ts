/**
 * Dev utility: verify the seeded credentials against the real hashing code and
 * mint a session token for smoke-testing authenticated routes with curl.
 *
 * Prints the token on stdout; diagnostics go to stderr.
 *   npx tsx scripts/dev-session.ts
 */
import { createHash, randomBytes } from 'node:crypto'
import { PrismaClient } from '@prisma/client'
import { verifyPassword } from '../src/server/password'

const prisma = new PrismaClient()

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('dev-session refuses to run in production')
  }

  const email = process.env.SEED_USER_EMAIL ?? 'admin@motorflip.local'
  const password = process.env.SEED_USER_PASSWORD ?? 'motorflip123'

  const user = await prisma.user.findUniqueOrThrow({ where: { email } })

  const accepted = await verifyPassword(password, user.passwordHash)
  const rejected = await verifyPassword('definitely-not-the-password', user.passwordHash)

  console.error(`correct password accepted : ${accepted}`)
  console.error(`wrong password rejected   : ${!rejected}`)
  if (!accepted || rejected) {
    throw new Error('password verification behaved incorrectly')
  }

  const token = randomBytes(32).toString('base64url')
  await prisma.session.create({
    data: {
      userId: user.id,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(Date.now() + 3_600_000),
    },
  })

  console.log(token)
}

main()
  .catch((error) => {
    console.error(error.message ?? error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
