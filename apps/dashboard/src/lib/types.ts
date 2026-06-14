import type { Network } from './networks'

export interface Reputation {
  count: number
  score: number | null
}

export interface ServiceView {
  /** `developer:name`. */
  id: string
  name: string
  description: string
  tags: string[]
  endpoint: string
  pricePerRequest: string
  paymentToken: string
  walletAddress: string
  developer: string
  network: Network
  agentId?: string
  reputation: Reputation | null
}
