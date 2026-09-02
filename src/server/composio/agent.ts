import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { getComposio, composioUserId } from './client'

/**
 * Composio-backed agent loop.
 *
 * Runs Claude against whatever toolkits the operator has connected, executing
 * tool calls through Composio and feeding results back until the model
 * finishes.
 *
 * Deliberately NOT the Claude Agent SDK: that harness spawns a Claude Code
 * process with filesystem and bash access, which has no place in a web request
 * handling a business's financial data. This is the plain Messages API loop —
 * the model can only reach the external apps the operator explicitly
 * authorised, and nothing local.
 */

/** A hard ceiling, so a confused model cannot loop indefinitely on our bill. */
const MAX_ITERATIONS = 8
const MODEL = 'claude-opus-5'

export interface AgentTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface AgentResult {
  reply: string
  toolsUsed: string[]
  iterations: number
  stopReason: string | null
  /** True when the loop hit MAX_ITERATIONS with work still outstanding. */
  truncated: boolean
}

export class NoToolkitsConnectedError extends Error {
  constructor() {
    super(
      'Belum ada aplikasi yang terhubung. Hubungkan minimal satu aplikasi di halaman Integrasi.',
    )
    this.name = 'NoToolkitsConnectedError'
  }
}

const SYSTEM_PROMPT = `Anda adalah asisten operasional untuk motoflip, aplikasi manajemen bisnis jual-beli motor bekas di Indonesia.

Gunakan tool Composio yang tersedia untuk menyelesaikan permintaan pengguna.

Aturan:
- Jawab dalam Bahasa Indonesia.
- Sebelum membuat, mengubah, atau menghapus data di aplikasi eksternal, jelaskan dulu apa yang akan Anda lakukan dan minta konfirmasi.
- Jika sebuah aplikasi belum terhubung, katakan aplikasi mana yang dibutuhkan. Jangan mengarang hasil.
- Jika Anda tidak yakin, katakan tidak yakin. Jangan menebak angka finansial.`

export async function runAgent(
  userId: string,
  message: string,
  history: AgentTurn[] = [],
): Promise<AgentResult> {
  const composio = getComposio()
  const scopedUser = composioUserId(userId)

  const connections = await composio.connectedAccounts.list({
    userIds: [scopedUser],
  })
  if ((connections.items ?? []).length === 0) {
    throw new NoToolkitsConnectedError()
  }

  // Only expose tools from toolkits this operator actually connected.
  const toolkitSlugs = [
    ...new Set(
      (connections.items ?? [])
        .map((account) => account.toolkit?.slug)
        .filter((slug): slug is string => Boolean(slug)),
    ),
  ]

  const tools = await composio.tools.get(scopedUser, {
    toolkits: toolkitSlugs,
    limit: 50,
  })

  const anthropic = new Anthropic()
  const messages: Anthropic.MessageParam[] = [
    ...history.map((turn) => ({ role: turn.role, content: turn.content })),
    { role: 'user' as const, content: message },
  ]

  const toolsUsed: string[] = []
  let iterations = 0
  let stopReason: string | null = null

  while (iterations < MAX_ITERATIONS) {
    iterations += 1

    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: 'adaptive' },
      system: SYSTEM_PROMPT,
      messages,
      tools,
    })

    stopReason = response.stop_reason

    // A safety decline arrives as HTTP 200 — check before reading content.
    if (response.stop_reason === 'refusal') {
      return {
        reply:
          'Permintaan ini ditolak oleh filter keamanan. Coba rumuskan ulang permintaan Anda.',
        toolsUsed,
        iterations,
        stopReason,
        truncated: false,
      }
    }

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason !== 'tool_use') {
      return {
        reply: textOf(response),
        toolsUsed,
        iterations,
        stopReason,
        truncated: false,
      }
    }

    for (const block of response.content) {
      if (block.type === 'tool_use') toolsUsed.push(block.name)
    }

    // Composio executes the calls and returns properly shaped tool_result
    // blocks, including errors — which must be fed back, not swallowed.
    const results = await composio.provider.handleToolCalls(
      scopedUser,
      response,
    )
    messages.push(...results)
  }

  return {
    reply:
      'Tugas ini membutuhkan terlalu banyak langkah dan dihentikan untuk keamanan. Coba pecah menjadi permintaan yang lebih kecil.',
    toolsUsed,
    iterations,
    stopReason,
    truncated: true,
  }
}

function textOf(response: Anthropic.Message): string {
  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()
}
