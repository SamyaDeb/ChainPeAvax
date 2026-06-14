/**
 * Register a seller agent's service on the ChainPe on-chain registry
 * (non-interactive). Pays the registration fee in USDC + gas from the seller's
 * wallet, and links the service to its ERC-8004 agentId.
 *
 * Run (env-driven):
 *   SELLER_KEY=0x... SELLER_NAME="Research Agent" SELLER_ENDPOINT=http://host:4501 \
 *   SELLER_TAGS=ai,research SELLER_PRICE=0.01 SELLER_AGENT_ID=12 \
 *   node register-seller.mjs
 */
import 'dotenv/config'
import { ChainPeRegistryClient } from '@chainpe/cli'

const network = process.env.CHAINPE_NETWORK || 'fuji'
const registryAddress = process.env.CHAINPE_REGISTRY_ADDRESS

function need(name) {
  const v = process.env[name]
  if (!v) {
    console.error(`Missing required env ${name}.`)
    process.exit(1)
  }
  return v
}

const privateKey = need('SELLER_KEY')
const name = need('SELLER_NAME')
const endpoint = need('SELLER_ENDPOINT')
const walletAddress = need('SELLER_PAYTO')

const client = new ChainPeRegistryClient(network, registryAddress)
const isUpdate = await client.hasService(walletAddress, name).catch(() => false)

console.log(`${isUpdate ? 'Updating' : 'Registering'} "${name}" → ${endpoint} on ${network}…`)
try {
  const result = await client.registerService({
    privateKey,
    name,
    description: process.env.SELLER_DESCRIPTION || `${name} — paid x402 service`,
    tags: (process.env.SELLER_TAGS || 'ai,agent').split(',').map((t) => t.trim()).filter(Boolean),
    endpoint,
    pricePerRequest: process.env.SELLER_PRICE || '0.01',
    paymentToken: 'USDC',
    walletAddress,
    network,
    agentId: process.env.SELLER_AGENT_ID || '0',
    isUpdate,
  })
  console.log(`✓ ${isUpdate ? 'updated' : 'registered'}  tx ${result.txnHash}`)
} catch (err) {
  console.error(`✗ ${err?.message || err}`)
  process.exit(1)
}
