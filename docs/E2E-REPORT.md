# ChainPe — End-to-End Validation Report (Phase 9)

Date: 2026-06-13. Run against the **live Avalanche Fuji** deployment (`docs/DEPLOYMENTS.md`).
Payer/deployer: `0x8cC8dADfAd2D39659314106bAf4Da10B3BA38A36`. All transactions are real and on-chain.

## Result: ✅ PASSED — full stack validated end-to-end

| # | Step | What it proves | Evidence (Fuji tx) |
|---|---|---|---|
| 1 | **Register service on-chain** | Provider `ChainPeRegistryClient` → USDC `approve` + `register()`; 0.1 USDC fee charged; stored & read back via `getService`. | [`0x658b4d4d…6d13`](https://testnet.snowtrace.io/tx/0x658b4d4d8810ca6d79b94b4097473072fd33680eded1ac8e55d33bc0d1d36d13) |
| 2 | **Discovery** | `listServices()` reads the registered service back via the on-chain `getServices` view (registry reported 2 services). | (read-only) |
| 3 | **ERC-8004 agent identity** | `register(agentURI)` on the live IdentityRegistry mints an ERC-721 agent id; read back. | [`0x60050e5d…3e8a`](https://testnet.snowtrace.io/tx/0x60050e5d2125dfdb6663cf31a6313ed1bae6a339473925566aae0c47515f3e8a) |
| 4 | **x402 `402 → pay → 200`** | Proxy returns 402 → consumer signs a USDC EIP-3009 authorization (`x402-fetch`) → **self-hosted facilitator settles on-chain** → backend data returned with HTTP 200. **Provider USDC balance went 0 → 0.01** (real value transfer). | settle [`0xb499441c…680d`](https://testnet.snowtrace.io/tx/0xb499441cd2955586362f753889e4f3671acf6af78f27c023c7e8e39dce40680d) |

Deployer USDC over the run: `0.99 → 0.98` (the 0.01 paid to the throwaway provider address; the 0.1 registration fee returned to itself as `feeRecipient`).

## Flows covered

- **Provider:** config → on-chain register (USDC approve + transferFrom) → live listing.
- **Consumer:** discover via registry view → `x402_fetch`-style auto-pay (sign EIP-3009, retry with `X-PAYMENT`).
- **Facilitator:** in-process (`chainpe start --facilitator <key>`) verify + settle on Avalanche, paying the gas — no external dependency.
- **Reputation:** ERC-8004 identity registration on-chain (feedback read/write paths covered by the contract unit suite — they require two funded accounts).

## Bug found & fixed during E2E

The in-process facilitator passed a plain viem **wallet client** to x402's `settle()`, which internally calls `verifyTypedData` — a **public** action. Fixed by extending the wallet client with `publicActions` in `packages/chainpe/src/proxy/localFacilitator.ts`. Re-validated green.

## How to reproduce

```bash
# provider proxy with self-hosted facilitator (funded gas key)
CHAINPE_FACILITATOR_KEY=0x... chainpe start
# consumer (MCP wallet or @chainpe/agent) configured with CHAINPE_PRIVATE_KEY + CHAINPE_REGISTRY_ADDRESS
```
