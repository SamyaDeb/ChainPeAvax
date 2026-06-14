import { createPublicClient, http, type PublicClient } from 'viem'
import {
  CHAINS,
  RPC_URLS,
  registryFor,
  REPUTATION_ADDRESS,
  NETWORK,
  type Network
} from './networks'
import { REGISTRY_ABI, REPUTATION_ABI } from './abi'
import type { ServiceView, Reputation } from './types'

function client(network: Network): PublicClient {
  return createPublicClient({
    chain: CHAINS[network],
    transport: http(RPC_URLS[network])
  })
}

interface RawService {
  name: string
  description: string
  tags: string
  endpoint: string
  pricePerRequest: string
  paymentToken: string
  network: string
  payTo: string
  developer: string
  agentId: bigint
  createdAt: bigint
  updatedAt: bigint
  exists: boolean
}

function decode(raw: RawService, network: Network): Omit<ServiceView, 'reputation'> {
  return {
    id: `${raw.developer}:${raw.name}`,
    name: raw.name,
    description: raw.description,
    tags: raw.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean),
    endpoint: raw.endpoint,
    pricePerRequest: raw.pricePerRequest,
    paymentToken: raw.paymentToken || 'USDC',
    walletAddress: raw.payTo,
    developer: raw.developer,
    network: (raw.network as Network) || network,
    agentId: raw.agentId > 0n ? raw.agentId.toString() : undefined
  }
}

/** Reads an agent's aggregate ERC-8004 reputation (getClients → getSummary). */
export async function reputationFor(
  network: Network,
  agentId: string
): Promise<Reputation | null> {
  const registry = REPUTATION_ADDRESS[network]
  if (!registry || !agentId || agentId === '0') return null
  try {
    const pub = client(network)
    const id = BigInt(agentId)
    const clients = (await pub.readContract({
      address: registry,
      abi: REPUTATION_ABI,
      functionName: 'getClients',
      args: [id]
    })) as readonly `0x${string}`[]
    if (clients.length === 0) return { count: 0, score: null }
    const [count, value, decimals] = (await pub.readContract({
      address: registry,
      abi: REPUTATION_ABI,
      functionName: 'getSummary',
      args: [id, clients as `0x${string}`[], '', '']
    })) as readonly [bigint, bigint, number]
    return { count: Number(count), score: Number(value) / 10 ** Number(decimals) }
  } catch {
    return null
  }
}

/** Lists all registered services with reputation, read directly from chain. */
export async function listServicesOnchain(
  network: Network = NETWORK
): Promise<ServiceView[]> {
  const pub = client(network)
  const address = registryFor(network)
  const count = (await pub.readContract({
    address,
    abi: REGISTRY_ABI,
    functionName: 'getServiceCount'
  })) as bigint

  const total = Number(count)
  if (total === 0) return []

  const pageSize = 100
  const raw: RawService[] = []
  for (let offset = 0; offset < total; offset += pageSize) {
    const limit = Math.min(pageSize, total - offset)
    const page = (await pub.readContract({
      address,
      abi: REGISTRY_ABI,
      functionName: 'getServices',
      args: [BigInt(offset), BigInt(limit)]
    })) as unknown as RawService[]
    raw.push(...page)
  }

  return Promise.all(
    raw.map(async r => {
      const base = decode(r, network)
      const reputation = base.agentId
        ? await reputationFor(network, base.agentId)
        : null
      return { ...base, reputation }
    })
  )
}
