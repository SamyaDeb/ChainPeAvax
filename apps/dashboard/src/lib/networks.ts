import { avalanche, avalancheFuji } from 'viem/chains'

export type Network = 'fuji' | 'avalanche'

export const NETWORK: Network =
  process.env.NEXT_PUBLIC_NETWORK === 'avalanche' ? 'avalanche' : 'fuji'

export const CHAINS = { fuji: avalancheFuji, avalanche } as const

export const RPC_URLS: Record<Network, string> = {
  fuji: 'https://api.avax-test.network/ext/bc/C/rpc',
  avalanche: 'https://api.avax.network/ext/bc/C/rpc'
}

export const USDC_ADDRESS: Record<Network, `0x${string}`> = {
  fuji: '0x5425890298aed601595a70AB815c96711a31Bc65',
  avalanche: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E'
}

export const REGISTRY_ADDRESS: Record<Network, `0x${string}` | undefined> = {
  fuji:
    (process.env.NEXT_PUBLIC_CHAINPE_REGISTRY_ADDRESS as `0x${string}`) ??
    '0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6',
  avalanche: process.env.NEXT_PUBLIC_CHAINPE_REGISTRY_ADDRESS as
    | `0x${string}`
    | undefined
}

export const REPUTATION_ADDRESS: Record<Network, `0x${string}` | undefined> = {
  fuji:
    (process.env.NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY as `0x${string}`) ??
    '0x89476DfEf9c72a668fa5E86f154B73EDB053aFe4',
  avalanche: process.env.NEXT_PUBLIC_ERC8004_REPUTATION_REGISTRY as
    | `0x${string}`
    | undefined
}

export const EXPLORER: Record<Network, string> = {
  fuji: 'https://testnet.snowtrace.io',
  avalanche: 'https://snowtrace.io'
}

export const CHAIN_ID: Record<Network, number> = {
  fuji: 43113,
  avalanche: 43114
}

export const USDC_DECIMALS = 6

export function registryFor(network: Network): `0x${string}` {
  const addr = REGISTRY_ADDRESS[network]
  if (!addr) throw new Error(`No ChainPeRegistry configured for ${network}.`)
  return addr
}

export function explorerAddress(network: Network, addr: string): string {
  return `${EXPLORER[network]}/address/${addr}`
}

export function explorerTx(network: Network, tx: string): string {
  return `${EXPLORER[network]}/tx/${tx}`
}
