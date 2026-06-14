import { describe, it, expect, vi, afterEach } from 'vitest'
import { ChainPe } from '../src/chainpe.js'

// Well-known Hardhat test account #0 (public, not a real secret).
const TEST_KEY =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const TEST_ADDR = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ChainPe construction', () => {
  it('requires a private key', () => {
    // @ts-expect-error intentional misuse
    expect(() => new ChainPe({})).toThrow(/privateKey/)
  })

  it('derives the wallet address and defaults to Fuji', () => {
    const cp = new ChainPe({ privateKey: TEST_KEY })
    expect(cp.getAddress().toLowerCase()).toBe(TEST_ADDR.toLowerCase())
    expect(cp.network).toBe('fuji')
    // Built-in Fuji registry defaults (checksummed).
    expect(cp.registryAddress).toBe(
      '0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6'
    )
    expect(cp.reputationRegistry).toBe(
      '0x89476DfEf9c72a668fa5E86f154B73EDB053aFe4'
    )
  })

  it('echoes config including maxPerCall default of 1 USDC', () => {
    const cp = new ChainPe({ privateKey: TEST_KEY })
    expect(cp.config.maxPerCall).toBe('1')
    expect(cp.config.network).toBe('fuji')
  })

  it('throws on mainnet without a registry override (no default deployed)', () => {
    expect(() => new ChainPe({ privateKey: TEST_KEY, network: 'avalanche' })).toThrow(
      /registry address/i
    )
  })
})

describe('ChainPe.fetch / pay', () => {
  it('passes non-402 responses straight through (no payment)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ hello: 'world' }), {
          status: 200,
          headers: { 'content-type': 'application/json' }
        })
      )
    )
    const cp = new ChainPe({ privateKey: TEST_KEY })
    const res = await cp.fetch('https://api.example.com/free')
    expect(res.status).toBe(200)

    const paid = await cp.pay<{ hello: string }>('https://api.example.com/free')
    expect(paid.ok).toBe(true)
    expect(paid.data.hello).toBe('world')
    expect(paid.payment).toBeUndefined()
  })

  it('rejects a 402 that demands more than maxPerCall', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            x402Version: 1,
            accepts: [
              {
                scheme: 'exact',
                network: 'avalanche-fuji',
                asset: '0x5425890298aed601595a70AB815c96711a31Bc65',
                maxAmountRequired: '5000000', // 5 USDC > 1 default cap
                payTo: '0x1111111111111111111111111111111111111111'
              }
            ]
          }),
          { status: 402, headers: { 'content-type': 'application/json' } }
        )
      )
    )
    const cp = new ChainPe({ privateKey: TEST_KEY, maxPerCall: '1' })
    await expect(cp.fetch('https://api.example.com/paid')).rejects.toThrow(
      /exceeds maxPerCall/
    )
  })

  it('errors when the server accepts only foreign networks', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            x402Version: 1,
            accepts: [{ scheme: 'exact', network: 'base', asset: '0x0', maxAmountRequired: '1', payTo: '0x0' }]
          }),
          { status: 402, headers: { 'content-type': 'application/json' } }
        )
      )
    )
    const cp = new ChainPe({ privateKey: TEST_KEY })
    await expect(cp.fetch('https://api.example.com/paid')).rejects.toThrow(
      /wallet is on fuji/
    )
  })
})
