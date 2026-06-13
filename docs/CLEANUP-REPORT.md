# ChainPe — Cleanup & Rebrand Report (Phase 7)

Date: 2026-06-13. Part of the Algorand → Avalanche migration. See `MIGRATION-AUDIT.md`.

## Files deleted

| Path | Reason | Dependencies affected |
|---|---|---|
| `contracts/src/ChainPeRegistry.algo.ts` | Algorand TEALScript contract — replaced by `contracts/contracts/ChainPeRegistry.sol`. | None (Hardhat compiles `contracts/contracts/`). |
| `contracts/src/out/*` (`.teal`, `.arc32.json`, `.arc56.json`, `*.puya.map`) | Compiled Algorand artifacts (AVM bytecode/ABI). | None. |
| `packages/chainpe/src/facilitator/` (algorand-client, algo-facilitator, simple-verifier, local-facilitator-client, index) | Algorand x402-AVM facilitators — replaced by `proxy/localFacilitator.ts` (EVM) + external facilitator URL. | Rewired in `proxy/server.ts`. |
| `packages/chainpe/src/x402/algo/server-scheme.ts` | Algorand "algo-exact" scheme — x402-express handles EVM schemes. | Removed from `proxy/server.ts`. |
| `packages/chainpe/src/wallet-connect.ts`, `wallet-connect-terminal.ts` | Pera/WalletConnect-v1 QR signing — EVM signs with a private key. | Removed from `cli.ts`. |
| `packages/chainpe/register-public.mjs` | Algorand mnemonic re-registration script — superseded by `chainpe register`. | None. |
| `packages/chainpe-wallet/src/tools/tinyman-swap.ts` | Tinyman is an Algorand DEX — no 1:1 EVM equivalent (Trader Joe could be added later). | Unregistered in `server.ts`. |
| `packages/chainpe-wallet/src/tools/create-token.ts` | Created Algorand Standard Assets (ASA). | Unregistered in `server.ts`. |
| `packages/chainpe-wallet/src/tools/transfer-algo.ts` | Replaced by `transfer-avax.ts` (native AVAX). | Re-registered as `transfer_avax`. |
| `packages/chainpe-wallet/src/nfd.ts` | NFDomains (.algo/.nfd) resolution — Algorand naming. | Removed from transfer tools. |
| `packages/chainpe-agent/src/x402/algo/client-scheme.ts` | Algorand "algo-exact" client scheme. | Replaced by x402-fetch in `payment.ts`. |
| `packages/chainpe-agent/scripts/test-agent-flow.ts`, `test-keychain.ts` | Dev scripts using algosdk + mnemonics. | None (not in build). |
| `packages/chainpe-agent/examples/example.ts` | SDK usage example using removed mnemonic APIs. | None. |
| `packages/chainpe-wallet/chainpe.mcpb` | Committed build artifact — rebuilt via `npm run build:mcpb`. | None. |
| `packages/chainpe-wallet/assets/PIXA-LOGO.PNG`, `image.png` | Legacy "Pixa" branding assets (project's former name). | None (manifest icon is `chainpe-logo.png`). |
| `frontend/IMG_8555.MOV` (≈5 MB) | Stray, unused media file. | None. |
| `.DS_Store` (root, `packages/`, `packages/chainpe-wallet/`) | macOS metadata, gitignored. | None. |

## Untracked from git (build artifacts that were committed)

`git rm --cached` on `packages/*/dist/` — these are gitignored but had been committed. Working-tree files retained; only removed from the index.

## Dependency removals

| Package | Removed | Added |
|---|---|---|
| `contracts` | `@algorandfoundation/algorand-typescript`, `@algorandfoundation/algokit-utils`, `algosdk` | `hardhat`, `@nomicfoundation/hardhat-toolbox`, `@openzeppelin/contracts(-upgradeable)@5.4.0`, `dotenv` |
| `@chainpe/cli` | `algosdk`, `@x402-avm/*`, `@perawallet/connect`, `@walletconnect/client`, `qrcode-terminal`, `open` | `viem`, `x402`, `x402-express` |
| `chainpe-wallet-mcp` | `algosdk`, `@x402-avm/*` | `viem`, `x402`, `x402-fetch` |
| `@chainpe/agent` | `algosdk`, `@x402-avm/*`, **`ai-sdk-ollama`** (the source of the `ai@5`/`ai@6` peer conflict) | `viem`, `x402`, `x402-fetch` |
| `examples/proxy-railway` | `algosdk`, `@x402-avm/*` | `x402`, `x402-express` |

**Result:** root `npm install` now resolves cleanly **without `--legacy-peer-deps`**. No `algosdk`, `@x402-avm/*`, `@algorandfoundation/*`, or `@perawallet/*` remains in any package's source or dependencies.

## Rebrand (copy)

Algorand → Avalanche across `frontend/index.html`, `frontend/docs.html`, `frontend/README.md`, root `README.md` (rewritten), all package READMEs, `PROVIDER-SETUP.md`, `CONSUMER-SETUP.md`, and `docs/STRUCTURE.md`. Mappings: Algorand→Avalanche, ALGO→USDC/AVAX, Pera→Core Wallet, Tinyman→Trader Joe, TEAL/ARC-4/ASA→Solidity/ERC-20, mnemonic→private key, 4-second→~1-second finality, App ID `757478481`→contract address, algonode/perawallet/dappflow URLs→Avalanche RPC/Snowtrace, x402-AVM→x402, "Pixa"→ChainPe.

`docs/MIGRATION-AUDIT.md` intentionally retains Algorand references — it is the historical audit of the source system.
