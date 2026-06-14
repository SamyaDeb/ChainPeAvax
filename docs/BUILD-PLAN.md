# ChainPe — Build Plan / Roadmap

> **For the implementing agent:** This is the authoritative plan. Read it fully, then read the
> existing code before changing anything. ChainPe is already a working, deployed product — most
> phases **build on top of** what exists. Do **not** rebuild what's marked done. After every phase,
> run the verification gates and keep the repo green.

---

## 1. What ChainPe is (thesis)

**x402 payment + reputation infrastructure for the Avalanche agent economy.** Providers monetize any
HTTP API (or an AI agent) per-request in USDC with one command; AI agents discover, pay for, and
rate those services autonomously; a non-custodial facilitator settles on Avalanche C-Chain in ~1s;
every paid call builds portable on-chain **ERC-8004** reputation.

Positioning: **infrastructure / picks-and-shovels**, not a single consumer app. Claude/MCP is just
one client. Win condition for the grant = adoptable SDK + multiple surfaces + a visible product +
the agent-to-agent + reputation differentiator.

---

## 2. Current state (DONE — do not rebuild)

- **Contracts** (`contracts/`, Hardhat + Solidity 0.8.28, OpenZeppelin):
  - `ChainPeRegistry.sol` — service registry (register/update/deregister, paginated `getServices`,
    USDC fee via approve+transferFrom, events, `Ownable2Step`, `ReentrancyGuard`, optional `agentId`).
  - Vendored **ERC-8004** registries in `contracts/contracts/erc8004/` (Identity/Reputation/Validation,
    UUPS proxies). 30 passing tests, 100% line cov on the registry.
- **Provider** (`packages/chainpe`, `@chainpe/cli`): Express x402 **proxy** (`x402-express`), viem
  `ChainPeRegistryClient`, CLI `init/start/register/deregister/list/status`, **browser/MetaMask
  registration** (`wallet-connect-browser.ts`), optional in-process facilitator.
- **Consumer wallet MCP** (`packages/chainpe-wallet`, `chainpe-wallet-mcp`): 9 tools incl.
  `search_bazaar` (shows ⭐ reputation), `x402_fetch` (auto-pays + auto-posts feedback), `pay`,
  `transfer_usdc`, `transfer_avax`, `give_feedback`, `spending_report`, `request_funding`,
  `check_balance`. 62 vitest tests. `reputation.ts` reads/writes ERC-8004.
- **Agent SDK** (`packages/chainpe-agent`, `@chainpe/agent`): LLM agent loop (Vercel AI SDK),
  `discoverService` (shows reputation), `callPaidApi` (auto-feedback), `payment.ts` (x402-fetch),
  keychain key storage, `reputation.ts`.
- **Facilitator service** (`services/chainpe-facilitator`): standalone, non-custodial
  `/verify` `/settle` `/supported` `/health`. Railway-ready. Live-proven settling on Fuji.
- **Frontend** (`frontend/`): static landing + docs (Avalanche-branded).

### Deployed on Avalanche Fuji (chainId 43113) — see `docs/DEPLOYMENTS.md`
| Contract | Address |
|---|---|
| ChainPeRegistry (verified) | `0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6` |
| ERC-8004 Identity | `0x56FEc2359fcDfFa6FA1D3a8AB3b708Ff698161D5` |
| ERC-8004 Reputation | `0x89476DfEf9c72a668fa5E86f154B73EDB053aFe4` |
| ERC-8004 Validation | `0xd8810c97B462FbD6b3706C12F588c58546f8159c` |
| USDC (Fuji, Circle) | `0x5425890298aed601595a70AB815c96711a31Bc65` |
| Deployer / owner | `0x8cC8dADfAd2D39659314106bAf4Da10B3BA38A36` |

Registration fee on Fuji: **0.1 USDC**. Mainnet (43114) not deployed.

### Tech stack / conventions
- TypeScript (ESM). **viem** in runtime packages; **ethers v6** only in `contracts/` (Hardhat).
- Payments: **Coinbase x402** (`x402`, `x402-express`, `x402-fetch`), USDC via EIP-3009.
- Build: `tsup` per package; npm workspaces (`packages/*`). `services/*` and `examples/*` are NOT
  workspaces (standalone). Contracts is its own Hardhat project (not a workspace).
- Secrets: only in gitignored `.env` (`DEPLOYER_PRIVATE_KEY`, `CHAINPE_PRIVATE_KEY`, …). Never commit.
- Networks: `fuji` (testnet) / `avalanche` (mainnet). x402 ids: `avalanche-fuji` / `avalanche`.

---

## 3. Verification gates (run after EVERY phase — must stay green)

```bash
npm install                              # clean, NO --legacy-peer-deps
npm run typecheck                        # all packages
npm run build                            # all packages
npm run test:wallet                      # wallet vitest
cd packages/chainpe-wallet && npm run lint   # 0 errors
cd contracts && npm test                 # 30+ contract tests
```
New packages must add their own `typecheck`/`build`/`test` and pass. Never leave TODOs, mock data
in non-test code, hardcoded secrets, or type/lint/build errors.

---

## 4. Critical technical notes / gotchas (READ — these cost hours otherwise)

1. **x402 `settle()` needs public actions.** The viem wallet client passed to `settle()` must be
   `createWalletClient({...}).extend(publicActions)` — `settle` internally calls `verifyTypedData`.
   (See `services/chainpe-facilitator/src/server.ts` and `packages/chainpe/src/proxy/localFacilitator.ts`.)
2. **ERC-8004 `getSummary` requires the client list.** It reverts on empty `clientAddresses`. Always
   call `getClients(agentId)` first; empty list ⇒ unscored (`count 0`). See `reputation.ts` in wallet/agent.
3. **`agentId === 0` means unlinked** (no reputation). Skip feedback/score for those.
4. **ERC-8004 blocks self-feedback** — a provider can't rate its own agent. Scores only accrue from
   *other* funded accounts. Tests that exercise feedback need ≥2 accounts.
5. **Discovery/feedback are O(N) RPC today.** `listAllServices()` paginates the whole registry, and
   `x402_fetch` does a full scan to resolve `agentId` by `payTo` for auto-feedback. Phase 4 (indexer)
   and Phase 3b (agentId-in-402) fix this. Don't scale-test without them.
6. **Reputation registry default** is hardcoded per network in `reputation.ts` (Fuji address above);
   override via `ERC8004_REPUTATION_REGISTRY` or config.
7. **EIP-3009 + smart accounts wrinkle** (Phase 6): x402's `exact` scheme signs an EOA EIP-3009
   authorization. Smart-account/4337 payment needs EIP-1271 or a different path — this is why the
   plan recommends **Option B (PolicyVault + session key)** over full ERC-4337.
8. **Deploy/verify:** `cd contracts && npm run deploy:erc8004 && IDENTITY_REGISTRY=0x… npm run
   deploy:fuji && npm run verify:fuji`. Snowtrace verify works keyless via Routescan (any non-empty
   `SNOWTRACE_API_KEY`).

---

## 5. Phases

Legend: **MUST** = needed to win · **STRETCH** = extra wow if time allows. Effort = rough dev-days.

### Phase 0 — Positioning & docs · ½d · MUST
- **Goal:** lock the infra thesis (§1) across README + a 1-page pitch + architecture diagram.
- **Steps:** rewrite README hero to lead with "infra for the Avalanche agent economy"; produce
  `docs/PITCH.md` (problem → solution → demo → why Avalanche → proof) and an architecture diagram.
- **Acceptance:** README + `docs/PITCH.md` exist and tell the infra story; no "paid API" framing.

### Phase 1 — Client SDK "payments in 3 lines" · 2–3d · MUST ⭐
- **Goal:** a clean, published SDK so any dev adds x402 payments in 3 lines.
- **Create:** `packages/chainpe-sdk` (`@chainpe/sdk`). Wrap `x402-fetch` + viem.
  - `new ChainPe({ privateKey, network, registryAddress?, facilitatorUrl?, reputationRegistry? })`
  - methods: `.fetch(url, opts)` (auto-pay 402), `.pay(...)`, `.discover(query)` (registry read,
    reputation-ranked), `.getReputation(agentId)`, `.giveFeedback(agentId, score)`,
    `.getAddress()`, `.balance()`.
  - Reuse logic from `packages/chainpe-wallet/src/{clients,chainpe-registry,reputation}.ts` — extract
    shared core rather than copy-paste where practical.
- **Deliver:** package + `README` quickstart + `examples/`; publishable to npm.
- **Acceptance:** `const cp = new ChainPe({privateKey, network:'fuji'}); const r = await cp.fetch(url)`
  pays and returns data against the live Fuji facilitator; typecheck/build/tests pass.

### Phase 2 — Multi-surface integrations · 2–3d · MUST
- **Goal:** prove it's not Claude-only.
- **Create (thin adapters over `@chainpe/sdk`):**
  - `packages/chainpe-ai-tools` → a **Vercel AI SDK** tool + a **LangChain** tool
    (`chainpeFetchTool`, `discoverServiceTool`) an agent can call.
  - a **CLI** surface: `chainpe fetch <url>` (extend `@chainpe/cli` or a new bin) for curl-level use.
  - MCP wallet already exists — leave it.
- **Deliver:** 2 framework tools + CLI + one runnable example agent per surface.
- **Acceptance:** the same paid fetch works from (a) Vercel/LangChain agent, (b) CLI — both settle on Fuji.

### Phase 3 — Agent-to-agent marketplace (sellers + reputation) · 2–4d · MUST ⭐
- **Goal:** agents that get paid and do real work; agents hiring agents; reputation-ranked.
- **Create:** `examples/seller-agents/` with ≥2 LLM-backed seller agents:
  - `research-agent` (returns sourced data) and `news-digest-agent` (`POST /summarize {text}` → LLM
    summary). Each = a small Express server (see `docs/` demo sketch) put behind `chainpe start`.
  - `launch.sh` — runs both backends + their chainpe proxies + registers them on-chain (each with a
    distinct wallet + an ERC-8004 `agentId`).
  - `orchestrator` demo (a `@chainpe/agent` or SDK script): buyer agent discovers (ranked by ⭐),
    **hires both seller agents in sequence**, pays each in USDC, composes the result.
- **Polish:** ensure `discover`/`search_bazaar` sort by reputation; confirm auto-feedback fires.
- **3b (recommended quick win):** make the provider proxy include the provider's `agentId` in the
  402 response (header or body) so consumers don't full-scan the registry to leave feedback
  (`packages/chainpe/src/proxy/routeConfig.ts` + `server.ts`; consumers read it in `x402_fetch`/`callPaidApi`).
- **Acceptance:** live demo — buyer agent pays 2 seller agents, gets real LLM output, seller wallets
  receive USDC, seller reputation increases on-chain.

### Phase 4 — Public facilitator + event indexer · 2–3d · facilitator MUST / indexer STRETCH
- **Facilitator (MUST):** deploy `services/chainpe-facilitator` publicly (Railway) → a stable URL
  integrators set as `CHAINPE_FACILITATOR_URL`. Fund its key with AVAX for gas. Document it.
- **Indexer (STRETCH but high value):** new `services/chainpe-indexer` — watch `ChainPeRegistry`
  (`ServiceRegistered/Updated/Deregistered`) + ERC-8004 Reputation events → Postgres → REST/GraphQL
  query API. Makes discovery + reputation O(1) and powers the dashboard. (Drizzle ORM + viem
  `watchContractEvent` or polling; Railway + Postgres.)
- **Acceptance:** facilitator reachable at a public URL (a provider settles through it); indexer
  exposes `/services` + `/services/:id/reputation` reflecting on-chain state.

### Phase 5 — Web dashboard / marketplace UI · 3–4d · MUST
- **Goal:** a visible product (judges/screenshots).
- **Create:** `apps/dashboard` (Next.js). Pages: marketplace (browse services + ⭐ reputation + price),
  service detail (reputation history, endpoint), provider view (revenue/calls — from indexer),
  MetaMask connect to register/manage a service (reuse the browser-signing flow).
- **Data source:** indexer if built (Phase 4), else read on-chain directly via viem.
- **Acceptance:** deployed dashboard lists live Fuji services with real reputation; a provider can
  register from the browser.

### Phase 6 — Gasless + programmable spending policies · 4–6d · STRETCH ⭐ (the "wow")
- **Goal:** owner sets on-chain limits; agent spends gaslessly within them; chain blocks overspend.
- **Decision:** use **Option B — `PolicyVault` + session key + relay** (NOT full ERC-4337; see §4.7).
- **Create:** `contracts/contracts/PolicyVault.sol`:
  - Holds an owner's USDC. Owner sets policy: `maxPerCall`, `dailyCap`, `allowlist` (or min
    reputation), `expiry`, `totalBudget`. Grants a **session key** (scoped signer).
  - `spend(to, amount, sessionSig)` releases USDC only if within policy + session key valid; reverts
    otherwise. `revokeSession()`. Emit events. Tests incl. the **over-cap revert**.
  - Relay/gasless: the facilitator (or a relayer) submits the spend so the agent pays no AVAX.
- **Integrate:** SDK + wallet/agent spend via the vault session key; on violation surface the
  on-chain rejection.
- **Acceptance:** demo — agent pays within policy gaslessly; an over-cap or non-allowlisted attempt
  is **rejected on-chain** (visible on Snowtrace); owner revokes the session key.

### Phase 7 — Avalanche-native flourish · 2–5d · STRETCH
- Pick the lightest that fits: **ICM/Teleporter cross-subnet payment** demo, OR a **subnet/L1**
  deployment of the registry, OR strong "why Avalanche" messaging (sub-second finality, sub-cent fees).
- **Acceptance:** one concrete Avalanche-specific artifact or a crisp section + numbers.

### Phase 8 — Demo + submission package · 2d · MUST
- **Deliver:** recorded demo video (storyboard in §6), slides + `docs/PITCH.md`, README with live
  links (Snowtrace, npm, dashboard, facilitator), 60-second pitch.
- **Acceptance:** a reviewer can watch the video, click live links, and run the quickstart.

---

## 6. Demo storyboard (what the video must show)

1. **Same payment, 3 surfaces** — pay a service from Claude/MCP, a LangChain/Vercel agent, and the
   CLI; all settle on Fuji. → "This is infra, not an app."
2. **Agent hires agent** — buyer agent discovers (ranked by ⭐), hires `research-agent` +
   `news-digest-agent`, pays each in USDC; seller terminals show LLM work *after* payment; seller
   wallets + reputation go up.
3. **Provider onboarding in 60s** — `chainpe init/start/register` (browser/MetaMask) → an existing API
   is monetized, live on Snowtrace.
4. **(Phase 6) The chain blocks an overspend** — agent tries to exceed its on-chain policy → rejected
   live on Snowtrace. ← the winning moment.

Screen layout: Claude/agent (left) · ChainPe logs (middle) · Snowtrace on the wallet (right).

---

## 7. Recommended scope paths

- **Minimum winning (~2 weeks):** Phases 0 → 1 → 2 → 3 (incl. 3b) → 4(facilitator) → 5 → 8.
- **Winning + wow (~3–4 weeks):** add Phase 6, then one Phase 7 item.
- **Dependency order:** 1 before 2 & 5; 4(indexer) before 5 (else read chain directly); 6 is parallel.

---

## 8. Architecture decisions (locked)

- Payments: Coinbase x402 + USDC (EIP-3009). Web3: viem (runtime) / ethers (contracts).
- Facilitator: **non-custodial** (key pays gas + relays the payer's signed authorization; never holds funds).
- Reputation: ERC-8004 (Identity + Reputation; Validation for Phase 6+). Scores are aggregated
  on-chain by the Reputation Registry (`getSummary`).
- Spending policy (Phase 6): **PolicyVault + session key + relay** (Option B), not ERC-4337.
- Registration fee token: USDC. Frontend: static + (optional) dashboard app.
