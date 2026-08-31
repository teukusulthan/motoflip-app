import 'server-only'
import type { MarketModelRef, MarketSnapshot } from '@/domain/market/types'

/**
 * Market data provider abstraction — §36.
 *
 * The application never talks to a data source directly. Adding a real
 * provider later means implementing this interface and registering it; no
 * screen, score or domain function changes.
 */
export interface MarketDataProvider {
  readonly id: string
  readonly label: string
  /**
   * True when this provider invents its data. Providers must declare this
   * honestly: it is what forces NONE confidence and the illustration banner
   * all the way through to the UI (§39).
   */
  readonly isSynthetic: boolean
  readonly methodology: string

  /**
   * Monthly snapshots for one model, oldest first.
   * Returns an empty array when the provider knows nothing about the model,
   * never a fabricated placeholder.
   */
  getSnapshots(ref: MarketModelRef, months: number): Promise<MarketSnapshot[]>
}

const registry = new Map<string, MarketDataProvider>()

export function registerProvider(provider: MarketDataProvider): void {
  registry.set(provider.id, provider)
}

export function getProvider(id: string): MarketDataProvider | null {
  return registry.get(id) ?? null
}

export function listProviders(): MarketDataProvider[] {
  return [...registry.values()]
}

/**
 * The provider used for automatic snapshots.
 *
 * Selected by MARKET_PROVIDER; defaults to the demo provider so a fresh
 * install shows a working feature that is unmistakably labelled as synthetic.
 */
export function activeProviderId(): string {
  return process.env.MARKET_PROVIDER ?? 'demo'
}
