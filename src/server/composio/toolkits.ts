import 'server-only'
import { getComposio, composioUserId } from './client'

/**
 * Toolkit and connection management.
 *
 * A toolkit is an app (Gmail, Notion, Google Sheets…). Nothing can be executed
 * until the operator authorises one, so these functions drive that flow.
 */

export interface ToolkitSummary {
  slug: string
  name: string
  logo: string | null
  description: string | null
  connected: boolean
  connectedAccountId: string | null
  status: string | null
}

/** Toolkits the operator has already authorised. */
export async function listConnections(userId: string) {
  const composio = getComposio()
  const result = await composio.connectedAccounts.list({
    userIds: [composioUserId(userId)],
  })
  return result.items ?? []
}

/**
 * Begin an OAuth connection.
 *
 * Returns a redirect URL the operator opens to grant access. Composio holds
 * the credentials; they never touch this application or its database.
 */
export async function initiateConnection(userId: string, toolkitSlug: string) {
  const composio = getComposio()
  const connection = await composio.toolkits.authorize(
    composioUserId(userId),
    toolkitSlug,
  )
  return {
    id: connection.id,
    redirectUrl: connection.redirectUrl ?? null,
  }
}

export async function removeConnection(userId: string, connectedAccountId: string) {
  const composio = getComposio()

  // Re-check ownership: a connected-account id from the client is never
  // trusted to belong to the signed-in operator (§45).
  const owned = await listConnections(userId)
  if (!owned.some((account) => account.id === connectedAccountId)) {
    throw new Error('Koneksi tidak ditemukan.')
  }

  await composio.connectedAccounts.delete(connectedAccountId)
}
