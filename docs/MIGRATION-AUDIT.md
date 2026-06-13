# ChainPe — Algorand → Avalanche C-Chain Migration Audit

**Status:** Phase 1–2 deliverable (audit + migration blueprint). **No code changed yet.**
**Date:** 2026-06-13
**Scope:** Full repository audit and migration plan from Algorand (TEAL/ARC-4 + x402-AVM) to Avalanche C-Chain (Solidity/EVM + EVM x402).

---

## 0. Executive Summary

ChainPe is a **decentralized API marketplace with x402 pay-per-request micropayments**. It has three runtime surfaces and one on-chain component:

| Component | Role | Chain coupling |
|---|---|---|
| `contracts/ChainPeRegistry.algo.ts` | On-chain service registry (TEALScript/Puya → TEAL, ARC-4) | **100% Algorand** |
| `packages/chainpe` (`@chainpe/cli`) | Provider CLI + x402 reverse proxy + facilitator | **High** (algosdk, x402-avm, registry client) |
| `packages/chainpe-wallet` (MCP) | Claude Desktop wallet extension (x402 consumer) | **High** (algosdk, x402-avm, keychain, NFD) |
| `packages/chainpe-agent` (`@chainpe/agent`) | Standalone AI agent that pays for APIs | **High** (duplicate of wallet logic + keytar) |
| `frontend/` | Static marketing + docs site | **Cosmetic only** (copy/branding; no wallet code) |
| `examples/` | Sample backend APIs being proxied | **None** (plain HTTP servers, chain-agnostic) |

**The single most important finding:** the entire payment layer is built on **`@x402-avm/*`** — an Algorand-Virtual-Machine–specific implementation of the x402 protocol. There is **no drop-in EVM equivalent inside this repo**. Migrating to Avalanche means replacing the payment scheme wholesale with the EVM x402 stack (Coinbase `x402` family, EIP-3009 `transferWithAuthorization` on USDC, or native AVAX). This is the dominant migration risk and effort driver — not the registry contract, which is comparatively simple.

**Second finding:** Phase 5 ("Frontend Migration — replace Algorand wallet integrations, implement MetaMask/Core/WalletConnect") assumes a dApp frontend that **does not exist**. `frontend/` is a static HTML/CSS site whose only JS does theme toggling and copy-to-clipboard. There are zero wallet integrations to "replace." Building MetaMask/Core/WalletConnect support would be **net-new feature work**, not a migration.

**Third finding:** `chainpe-agent` and `chainpe-wallet` are ~80% duplicated logic (wallet derivation, x402 client, on-chain registry reader). The migration is a good moment to decide whether to keep both.

---

## PHASE 1 — FULL CODEBASE AUDIT

### 1. Project Architecture Report

#### Frontend structure
- `frontend/index.html` (313 lines) — landing page. Heavy Algorand copy/branding only.
- `frontend/docs.html` (943 lines) — API docs page. References "Algorand Testnet", ALGO, 4-second finality, etc.
- `frontend/script.js` (129 lines) — theme toggle + install-command copy. **No blockchain code.**
- `frontend/style.css`, `frontend/README.md`, `frontend/IMG_8555.MOV` (stray asset).
- **Verdict:** no functional wallet integration. Migration = rebrand copy + (optionally) build a real dApp.

#### Backend structure
There is no central backend/server other than:
- The **x402 reverse proxy** in `packages/chainpe/src/proxy/server.ts` (Express). It sits in front of a provider's existing API, gates each request behind a 402, verifies/settles payment, then proxies to `targetUrl`.
- `examples/*.mjs` — sample provider backends (weather, BTC price, Hacker News). Chain-agnostic Express/HTTP servers.
- `examples/weather-railway/`, `examples/proxy-railway/` — Railway deploy configs for the above.

#### Smart contract structure
- Single contract: `contracts/src/ChainPeRegistry.algo.ts` (ARC-4, TEALScript/`@algorandfoundation/algorand-typescript`).
- Compiled artifacts in `contracts/src/out/`: `*.teal`, `*.arc32.json`, `*.arc56.json`, `*.puya.map`.
- Deploy script: `contracts/scripts/deploy.ts` (algokit-utils `AppFactory`).
- **Deployed:** Algorand Testnet App ID `757478481`, admin `CIQZP6I73Q5527QWZHZLZBIDSOHVV5LMP5IEQNQYVRXYOZTQSYB7X57PBE`.

#### API architecture (the x402 flow)
1. Consumer calls provider endpoint → proxy returns **402** with `Payment-Required` (base64 JSON `accepts[]`).
2. Consumer signs an Algorand payment (native ALGO `algo-exact` scheme, or USDC ASA `exact` scheme) and retries with `PAYMENT-SIGNATURE`/`X-PAYMENT` header.
3. Proxy **verifies** (decode signed txn, check receiver/amount/asset/genesis-hash) and **settles** (broadcast to algod, wait for confirmation), then proxies to `targetUrl`.
4. Three facilitator modes: `AlgoNativeFacilitator` (ALGO), `SimplePaymentVerifier` (USDC/ALGO, no key — relays client-signed txns), `LocalFacilitatorClient` (uses x402-avm in-process signer).

#### Database architecture
- **No database.** State is:
  - Local JSON config: `~/.chainpe/config.json` (provider), `~/.chainpe/wallet.json` (wallet MCP), `~/.chainpe/registry.json` (local mirror).
  - On-chain: ARC-54 BoxMap in the registry contract.
  - In-memory: `proxy/analytics.ts` (request/payment stats, not persisted).

#### Event system
- **No on-chain events.** The Algorand contract emits no logs/events; discovery works by **enumerating contract boxes via the Algorand Indexer** (`/v2/applications/{appId}/boxes`) and reading each via `simulate`. This is a key migration point: EVM gives us real `event` logs + indexers (Snowtrace, or a custom listener) instead of box enumeration.

#### Authentication flow
- No user accounts. "Auth" = possession of a wallet key.
  - Provider: only needs a **wallet address** to receive funds (no key for proxy). Registration signs with a 25-word mnemonic (pasted) or via WalletConnect/Pera QR.
  - Consumer (MCP/agent): 25-word mnemonic supplied via env (`ALGORAND_MNEMONIC`) or OS keychain (`keytar`, agent only) or `~/.chainpe/wallet.json`.
- Admin endpoints on the proxy gated by optional `x-admin-key` header.

#### Wallet integration flow
- **Provider CLI:** `algosdk.mnemonicToSecretKey`, WalletConnect v1 + Pera Connect for QR signing (`wallet-connect.ts`, `wallet-connect-terminal.ts`), atomic group `[payAdmin(1 ALGO), appCall]`.
- **Consumer MCP:** `algosdk` signer wrapped as x402-avm `ClientAvmSigner`; NFD (.algo/.nfd) name resolution via `api.nf.domains`.
- **Agent:** same, plus `keytar` OS keychain storage.

#### Build system
- npm workspaces monorepo. `tsup` for package bundling, `tsx` for dev, `tsc` for typecheck.
- Contract build: `algokit compile ts`.
- MCP bundle: `scripts/build-mcpb.sh` → `chainpe.mcpb` (Claude Desktop installable).
- Tests: `vitest` (wallet package only).

#### Deployment system
- Contract: `contracts/scripts/deploy.ts` via algokit-utils to Algorand testnet/mainnet (`DEPLOYER_MNEMONIC` env).
- Packages: `npm publish` to npm.
- Examples: Railway (`railway.json`/Nixpacks implied by `*-railway/` dirs).

---

### 2. Dependency Audit

#### Algorand-specific packages (REMOVE)
| Package | Where | Replacement |
|---|---|---|
| `algosdk` | all packages, contract | `ethers` v6 (or `viem`) |
| `@algorandfoundation/algorand-typescript` | contracts | Solidity + OpenZeppelin |
| `@algorandfoundation/algokit-utils` | contracts | Hardhat / Foundry |
| `@x402-avm/avm`, `@x402-avm/core`, `@x402-avm/express`, `@x402-avm/paywall` | chainpe, wallet, agent | `x402`, `x402-express`, `x402-fetch` (Coinbase EVM x402) **or** custom EVM scheme |
| `@perawallet/connect` | chainpe | WalletConnect v2 / browser wallet (only if a real frontend is built) |
| `@walletconnect/client` (v1) | chainpe | `@walletconnect/*` v2 (deprecated v1) — likely **drop** for CLI |
| `keytar` | agent | keep (chain-agnostic secret store) — stores EVM private key instead of mnemonic |

#### Chain-agnostic packages (KEEP)
`express`, `cors`, `http-proxy-middleware`, `commander`, `@clack/prompts`, `chalk`, `gradient-string`, `ora`, `picocolors`, `qrcode-terminal`, `open`, `dotenv`, `zod`, `@modelcontextprotocol/sdk`, `ai` + `@ai-sdk/*` (agent LLM), `vitest`, `tsup`, `tsx`, `typescript`, eslint/prettier toolchain.

#### Unused / dead / duplicate
- **Committed `dist/`** for `chainpe` and `chainpe-wallet` are tracked in git (the git status shows them as deleted-in-working-tree). `dist/` is in `.gitignore`; these should not be tracked. **Cleanup candidate.**
- **`chainpe.mcpb`** (binary bundle) committed — rebuild artifact.
- **Two `package-lock.json`** untracked at root and `contracts/` — needs reconciliation after dep changes.
- **`frontend/IMG_8555.MOV`** — stray media asset, almost certainly unused.
- **`packages/chainpe-wallet/assets/PIXA-LOGO.PNG`, `image.png`, `.DS_Store`** — stray/legacy ("Pixa" is the old project name; repo URLs point at `soumyacodes007/Pixa` and `AnomalyFi/chainpe` inconsistently).
- **`chainpe-agent` vs `chainpe-wallet`**: duplicate wallet/x402/registry logic (~80% overlap). Consolidation candidate.
- **`local-facilitator-client.ts` + `algo-facilitator.ts` + `simple-verifier.ts`**: three facilitator implementations; only the simple verifier and ALGO native are wired by default. On EVM this collapses to a single verify/settle path.
- **`.DS_Store`** files scattered (root, packages, chainpe-wallet) — should be gitignored/removed.

#### Unused components / APIs / contracts
- Registry contract methods `getAdmin()` / `getRegistrationFee()` are exposed but not called by any client code — informational only.
- `update()` path is reachable from CLI but lightly used.
- No unused *contracts* (only one exists).

---

### 3. Smart Contract Audit — `ChainPeRegistry`

#### Business logic
A fee-gated, developer-owned registry of API services. Each entry stores `{name, description, tags, endpoint, pricePerRequest, paymentToken, walletAddress, network, developer, createdAt, updatedAt}` in an ARC-54 **BoxMap** keyed by `"svc:" + developerPubkey(32) + ":" + name`.

| Method | Logic |
|---|---|
| `createApplication()` | onCreate hook; admin is a **hardcoded constant** (no stored state). |
| `register(payTx, …9 strings)` | Requires grouped `payTx` ≥ 1 ALGO to admin; asserts box absent; writes entry; sets `developer = Txn.sender`. |
| `update(payTx, …)` | Requires 1 ALGO; asserts box exists; asserts caller == original developer; preserves `createdAt`/`developer`. |
| `deregister(name)` | Asserts caller == developer; deletes box; refunds released MBR to developer via inner txn. |
| `getService(developer,name)` | readonly; returns the struct. |
| `hasService(developer,name)` | readonly bool. |
| `getAdmin()` / `getRegistrationFee()` | readonly constants. |

#### Contract interactions
- Client builds **atomic group** `[Payment(1 ALGO → admin), AppCall(register/update)]`; separately pre-funds the app address for box MBR.
- Reads use `algod.simulateTransactions` and parse the ARC-4 return value out of the transaction **logs** (4-byte return prefix `0x151f7c75`).
- Discovery enumerates boxes via **Indexer**, then simulates `getService` per box.

#### Algorand-specific logic that must change
- **Box storage / MBR economics** → EVM `mapping`/structs (no MBR; storage paid as gas).
- **Atomic transaction groups + inner-txn MBR refund** → not needed; EVM fee is paid in AVAX, refund logic disappears.
- **ARC-4 ABI encoding & log-return parsing** → standard ABI + view functions returning structs.
- **Box enumeration for discovery** → **emit events** (`ServiceRegistered`, `ServiceUpdated`, `ServiceDeregistered`) + a `getAllServices()`/paginated view, or an off-chain indexer reading logs.
- **Composite-string box key** → `mapping(bytes32 => Service)` with `keccak256(developer, name)` or nested `mapping(address => mapping(string => Service))`.
- **Hardcoded admin/fee** → `Ownable`/`AccessControl` + a settable fee.

#### Migration challenges
- The on-chain Algorand registry (App ID 757478481) and its live entries (Weather News, Hacker News) **cannot be migrated automatically** — they must be re-registered on Avalanche after the new contract is deployed. Decide whether to seed them.
- Discovery model changes from "enumerate boxes" to "read events / call a view" — every client's `listAllServices()` must be rewritten.

---

### 4. Security Audit

#### Findings on the current (Algorand) system
1. **Hardcoded admin address in the contract** (`ChainPeRegistry.algo.ts`) — not a vuln per se, but inflexible; migrate to role-based, settable owner.
2. **No event log** → off-chain consumers rely on Indexer box enumeration; brittle, and any box-key collision/format drift breaks discovery.
3. **Mnemonics handled in multiple places**:
   - Provider CLI accepts pasted mnemonic via `@clack` `password` prompt (not persisted) — OK.
   - Wallet MCP reads mnemonic from **env var** and **`~/.chainpe/wallet.json` (plaintext, mode 0600)** — plaintext on disk is a weakness; agent uses `keytar` (better).
   - `local-facilitator-client.ts` converts mnemonic→base64 secret key in memory — fine, but the facilitator-with-key mode broadens key exposure.
4. **`x402_fetch` / `pay` error string leakage** — verbose but low-risk.
5. **Input validation**: address validation is length+decode only; amounts parsed with hand-rolled decimal math (consistent but untyped); `note`/`tags` unbounded.
6. **Proxy**: permissive `cors()` (all origins); admin endpoints optional-key only; `changeOrigin` + header forwarding — standard reverse-proxy exposure.
7. **Reentrancy**: N/A on Algorand; **must be designed for** on the Solidity registry (use checks-effects-interactions; `ReentrancyGuard` on any fee-forwarding/refund path).
8. **Secret management for the migration itself**: the deployment private key provided in the task **must never be committed**. Plan: `.env` (gitignored) + `DEPLOYER_PRIVATE_KEY` read by Hardhat config; `.env.example` documents the variable name only.

#### Security requirements for the Avalanche rewrite
- `Ownable2Step` or `AccessControl` for admin; custom errors; `ReentrancyGuard` on fee paths.
- Validate `msg.value`/USDC `transferFrom` exactly equals the fee; reject excess or refund.
- Pull-over-push for fee withdrawal (owner withdraws), or direct forward with reentrancy guard.
- Frontend (if built): never expose keys; use injected provider signing only.
- CI: secret scanning; ensure `.env`, key material, and build artifacts are gitignored.

---

## PHASE 2 — AVALANCHE MIGRATION BLUEPRINT

### Component mapping

| Current (Algorand) | Avalanche C-Chain equivalent | Approach | Risk | Testing |
|---|---|---|---|---|
| `algosdk` | **`ethers` v6** (recommend) or `viem` | Replace all account/txn/balance/encoding calls | Medium — pervasive | Unit tests on wallet/balance/transfer helpers |
| TEALScript `ChainPeRegistry.algo.ts` | **Solidity `ChainPeRegistry.sol`** (0.8.x, OpenZeppelin) | Rewrite as mapping-based registry with events | Medium | Full Hardhat/Foundry suite |
| `algokit compile` + algokit-utils deploy | **Hardhat** (recommend) + ethers, or Foundry | New `hardhat.config.ts`, deploy/verify scripts | Low | Deploy to Fuji, verify on Snowtrace |
| `@x402-avm/*` (AVM x402) | **EVM x402**: `x402`, `x402-express`, `x402-fetch` (Coinbase) on USDC (EIP-3009) and/or native AVAX | Replace facilitator + client + route schemes | **High** — biggest fork | x402 verify/settle integration tests |
| ARC-54 BoxMap | Solidity `mapping` + structs | Key by `keccak256(developer,name)` | Low | Storage layout tests |
| Box enumeration via Indexer | **Solidity events** + view getters; optional off-chain indexer | `getServiceCount`/paginated `getServices`, or log listener | Medium | Indexer/event tests |
| Atomic group `[pay, appCall]` + MBR pre-fund | Single tx: `register()` payable (AVAX fee) **or** `register()` after USDC `approve` | Simplifies client greatly | Low | Fee-accounting tests |
| ALGO native + USDC ASA tokens | **AVAX native + USDC.e/native USDC ERC-20** on Avalanche | Update token tables, decimals (USDC=6 still) | Low | Balance/transfer tests |
| Pera/WalletConnect QR signing | Private-key signing (CLI) / injected wallet (frontend) | Drop Pera; keep mnemonic→key OR raw key | Low–Med | Signing tests |
| NFD (.algo/.nfd) resolution | **Avvy Domains / .avax** or ENS-style, or drop | Optional; recommend drop for v1 | Low | N/A |
| Algorand Indexer/Algod (algonode) | **Avalanche C-Chain RPC** (Fuji/mainnet) + Snowtrace API | RPC abstraction layer | Low | RPC mock tests |
| Genesis-hash network check | **chainId** check (43113 Fuji / 43114 mainnet) | Replace network identity | Low | Unit test |
| CAIP-2 `algorand:<genesis>` | CAIP-2 `eip155:43113` / `eip155:43114` | Update network constants | Low | Unit test |

### Network constants (target)

| | Fuji (testnet) | Mainnet |
|---|---|---|
| chainId | 43113 | 43114 |
| RPC | `https://api.avax-test.network/ext/bc/C/rpc` | `https://api.avax.network/ext/bc/C/rpc` |
| Explorer | `https://testnet.snowtrace.io` | `https://snowtrace.io` |
| USDC (native, Circle) | `0x5425890298aed601595a70AB815c96711a31Bc65` (Fuji) | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` (mainnet) |
| CAIP-2 | `eip155:43113` | `eip155:43114` |

*(USDC addresses to be re-verified against Circle docs at implementation time.)*

### Per-component migration detail (existing → replacement → approach → risk → tests)

**A. Registry contract** — existing TEAL ARC-4 BoxMap; → `ChainPeRegistry.sol` with `register`/`update`/`deregister`/`getService`/`hasService` + events + `Ownable2Step` + settable fee + custom errors; approach: clean rewrite, fee in AVAX (payable) or USDC; risk: medium; tests: unit (CRUD, access control, fee accounting, reentrancy), gas snapshots.

**B. Provider proxy/facilitator** (`packages/chainpe`) — existing Express proxy + 3 AVM facilitators; → Express proxy + EVM x402 (`x402-express` middleware or a thin custom verifier that checks an on-chain USDC `transferWithAuthorization` / native transfer); approach: replace `proxy/server.ts`, delete `facilitator/*` AVM code, rewrite `routeConfig.ts` for `eip155` networks; risk: high; tests: 402→pay→200 integration against a local backend + Fuji.

**C. Provider registry client** (`registry.ts`, `wallet-connect*.ts`) — existing algosdk atomic-group + ARC-4 encoding + Pera QR; → ethers contract calls (`registry.register(...)`); approach: rewrite, drop WalletConnect/Pera, sign with key or injected wallet; risk: medium; tests: register/update/deregister/list against Fuji.

**D. Consumer wallet MCP** (`packages/chainpe-wallet`) — existing algosdk signer + x402-avm client + box-enumeration discovery + ALGO/USDC transfers + DeFi (tinyman/create-token); → ethers wallet + `x402-fetch` client + event/view discovery + AVAX/USDC transfers; **drop Tinyman swap and ASA create-token** (Algorand-specific) or replace with a Trader Joe swap (decision needed); risk: high; tests: existing vitest suite rewritten.

**E. Agent SDK** (`packages/chainpe-agent`) — existing duplicate of D + keytar + LLM tools; → same migration as D; decision: **consolidate with wallet package** or keep separate; risk: high; tests: agent-flow + keychain.

**F. Frontend** — static site; → rebrand copy Algorand→Avalanche; **optionally** build a real dApp with MetaMask/Core/WalletConnect v2 + network switching + contract hooks (net-new); risk: low (rebrand) / high (new dApp); tests: wallet-connect/contract-interaction (only if dApp built).

**G. Examples + Railway** — chain-agnostic backends; minimal change (only any ALGO copy/price labels); risk: trivial.

---

## Cross-cutting decisions required before Phase 3 (these change the build)

1. **x402 payment library on EVM.** Adopt Coinbase's `x402` / `x402-express` / `x402-fetch` (USDC via EIP-3009 `transferWithAuthorization`), or build a custom minimal EVM payment scheme? *(Recommend: Coinbase x402 packages — they are the canonical EVM x402 implementation and support Avalanche-class EVM chains.)*
2. **Registration fee token.** Native **AVAX** (payable `register()`) or **USDC** (`approve`+`transferFrom`)? *(Recommend: native AVAX — simplest, mirrors the 1-ALGO model.)*
3. **Discovery mechanism.** On-chain events + a paginated view getter (no external infra), or a dedicated off-chain event indexer service? *(Recommend: events + `getServices` view for v1; add indexer later.)*
4. **Package consolidation.** Keep all three packages, or merge `chainpe-agent` into `chainpe-wallet`? *(Recommend: keep both for now to reduce blast radius; de-dup later.)*
5. **Frontend scope.** Rebrand the static site only, or build a real wallet-connected dApp (MetaMask/Core/WalletConnect)? *(This is the single biggest scope lever.)*
6. **Toolchain.** Hardhat or Foundry? *(Recommend: Hardhat — TS-native, matches the repo and the ethers choice, easy Snowtrace verify.)*
7. **Deploy target now.** Fuji only, or Fuji + mainnet config? *(Recommend: Fuji deploy now, mainnet config present but not deployed.)*

---

## Proposed execution order (Phases 3–10)

1. **Infra (Phase 4 first):** add Hardhat, `hardhat.config.ts` (Fuji+mainnet), `.env`/`.env.example` with `DEPLOYER_PRIVATE_KEY` (gitignored), RPC abstraction, deploy + verify scripts.
2. **Contract (Phase 3):** write `ChainPeRegistry.sol` + full test suite; deploy to Fuji; record address in `deployments/`.
3. **Provider package (Phase 6 backend):** rewrite proxy + EVM x402 + registry client; build/typecheck/test.
4. **Consumer wallet MCP (Phase 5/6):** rewrite signer/x402/discovery/transfers; rewrite vitest suite.
5. **Agent SDK:** same.
6. **Frontend (Phase 5):** rebrand (+ optional dApp).
7. **Cleanup (Phase 7):** delete all Algorand files/deps; deletion report.
8. **Testing (Phase 8) + E2E (Phase 9) + Production readiness (Phase 10).**

After **each** phase: `build`, `typecheck`, `lint`, `test` must pass before continuing.

---

---

## Addendum — Locked decisions & progress (updated 2026-06-13)

**Decisions confirmed by the user:**
- Payment layer → **Coinbase EVM x402** (`x402-express` proxy, `x402-fetch` client), USDC via EIP-3009.
- Registration fee → **USDC ERC-20** (`approve` + `transferFrom`).
- Frontend → **rebrand copy only** (no new dApp/wallet UI).
- Toolchain → **Hardhat**; deploy target **Fuji** now, mainnet config present, **deployment held until packages migrated**.
- Discovery → Solidity **events + paginated view**.
- **Agent reputation → ERC-8004 (Trustless Agents).** Vendor the official audited reference contracts; do not hand-reimplement.

### Phase 4 (infra) + Phase 3 (contracts) — COMPLETE
- `contracts/` converted to **Hardhat** (ethers v6, TypeChain, Snowtrace/Routescan verify) for Fuji (43113) + mainnet (43114).
- **`ChainPeRegistry.sol`** — Solidity 0.8.28, `Ownable2Step` + `ReentrancyGuard` + `SafeERC20`, custom errors, full events, USDC fee, mapping + swap-pop enumeration + paginated `getServices`, optional ERC-8004 `agentId` link.
- **ERC-8004 registries vendored verbatim** from `github.com/erc-8004/erc-8004-contracts` @ commit `68fc6765` into `contracts/contracts/erc8004/` (+ ABIs in `contracts/abis/erc8004/`). Deployed behind ERC-1967 proxies via the upstream bootstrap pattern (`scripts/lib/deployErc8004.ts`). OZ pinned to **5.4.0** so the vendored sources compile unmodified.
- Deploy scripts: `deploy.ts` (ChainPeRegistry, real-USDC defaults), `deploy-erc8004.ts`, `verify.ts`.
- **Verification:** compile ✓, typecheck ✓, **30 tests passing** (25 registry + 5 ERC-8004), coverage **100% lines/stmts/funcs** on `ChainPeRegistry.sol`.
- Real USDC wired: Fuji `0x5425890298aed601595a70AB815c96711a31Bc65`, mainnet `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E`. `MockUSDC` is test-only.

### Remaining (next phases)
Provider package (`chainpe`) → consumer wallet MCP → agent SDK → frontend rebrand → cleanup (delete Algorand `contracts/src/`, `*.algo.ts`, `out/`, x402-avm deps, dist artifacts) → testing → E2E → production readiness. On-chain Fuji deployment of `ChainPeRegistry` + ERC-8004 happens after the packages are migrated.

---

## Security handling of the provided deployment key

The private key supplied in the task will be placed **only** in a local, gitignored `.env` as `DEPLOYER_PRIVATE_KEY=` and consumed by `hardhat.config.ts` via `process.env`. It will **never** appear in source, committed config, scripts, or logs. `.env.example` will document the variable name with a placeholder. `.gitignore` already excludes `.env`.
