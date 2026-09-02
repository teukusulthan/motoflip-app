import 'server-only'
import { Composio } from '@composio/core'
import { AnthropicProvider } from '@composio/anthropic'

/**
 * Composio client — §36's provider-abstraction principle applied to tooling.
 *
 * The API key is read on the server only and never reaches the browser. Every
 * call is scoped to a Composio `userId`, which we set to the motoflip user's
 * own id so one operator's connected accounts are never visible to another.
 */

export class ComposioNotConfiguredError extends Error {
  constructor() {
    super(
      'COMPOSIO_API_KEY belum diatur. Tambahkan ke .env untuk mengaktifkan integrasi.',
    )
    this.name = 'ComposioNotConfiguredError'
  }
}

export const composioConfigured = (): boolean =>
  Boolean(process.env.COMPOSIO_API_KEY)

export const anthropicConfigured = (): boolean =>
  Boolean(process.env.ANTHROPIC_API_KEY)

let cached: Composio<AnthropicProvider> | null = null

export function getComposio(): Composio<AnthropicProvider> {
  const apiKey = process.env.COMPOSIO_API_KEY
  if (!apiKey) throw new ComposioNotConfiguredError()

  if (!cached) {
    cached = new Composio({ apiKey, provider: new AnthropicProvider() })
  }
  return cached
}

/**
 * Composio identifies users by an opaque string. Namespacing it keeps this
 * app's connections separate from anything else sharing the same Composio
 * account, and makes the origin obvious in Composio's dashboard.
 */
export const composioUserId = (userId: string): string => `motoflip:${userId}`
