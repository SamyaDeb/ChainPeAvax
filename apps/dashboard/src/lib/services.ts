import { NETWORK, type Network } from './networks'
import { listServicesOnchain } from './onchain'
import { rankByReputation } from './rank'
import type { ServiceView, Reputation } from './types'

interface IndexerService {
  id: string
  name: string
  description: string
  tags: string[]
  endpoint: string
  pricePerRequest: string
  paymentToken: string
  walletAddress: string
  developer: string
  network: string
  agentId?: string
  reputation: Reputation | null
}

function normalizeIndexer(rows: IndexerService[], network: Network): ServiceView[] {
  return rows.map(r => ({
    id: r.id,
    name: r.name,
    description: r.description,
    tags: r.tags ?? [],
    endpoint: r.endpoint,
    pricePerRequest: r.pricePerRequest,
    paymentToken: r.paymentToken || 'USDC',
    walletAddress: r.walletAddress,
    developer: r.developer,
    network: (r.network as Network) || network,
    agentId: r.agentId || undefined,
    reputation: r.reputation ?? null
  }))
}

/**
 * Fetches services with reputation, ranked best-first. Uses the indexer when
 * `INDEXER_URL` is set (O(1)); otherwise reads on-chain directly via viem.
 */
export async function fetchServices(): Promise<ServiceView[]> {
  const indexerUrl = process.env.INDEXER_URL
  if (indexerUrl) {
    try {
      const res = await fetch(`${indexerUrl.replace(/\/$/, '')}/services`, {
        next: { revalidate: 15 }
      })
      if (res.ok) {
        const rows = (await res.json()) as IndexerService[]
        return rankByReputation(normalizeIndexer(rows, NETWORK))
      }
    } catch {
      /* fall through to on-chain */
    }
  }
  return rankByReputation(await listServicesOnchain(NETWORK))
}

export async function fetchService(id: string): Promise<ServiceView | undefined> {
  const all = await fetchServices()
  return all.find(s => s.id === id)
}
