# ChainPe

**x402 payment + reputation infrastructure for the Avalanche agent economy.**

Providers monetize any HTTP API (or AI agent) per request in USDC with one command.
AI agents **discover, pay for, and rate** those services autonomously. A
non-custodial facilitator settles on **Avalanche C-Chain** in ~1–2s, and every paid
call builds portable on-chain **[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004)
reputation**.

ChainPe is **infrastructure, not a single app** — Claude/MCP is just one client.
The same payment + reputation core powers an SDK, framework tools, a CLI, a
marketplace dashboard, and programmable gasless spending.

> **Live on Avalanche Fuji:** `ChainPeRegistry` [`0x9167…22Bf6`](https://testnet.snowtrace.io/address/0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6#code) (verified) · full list in [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md)
>
> **Try it now:** [Marketplace dashboard](https://chainpe-dashboard-production.up.railway.app) · [Indexer API](https://chainpe-indexer-production.up.railway.app/services)

---

## Payments in 3 lines

```ts
import { ChainPe } from '@chainpe/sdk'

const cp = new ChainPe({ privateKey: process.env.PRIVATE_KEY!, network: 'fuji' })
const res = await cp.fetch('https://api.example.com/paid')  // auto-pays a 402 in USDC
const data = await res.json()
```

`cp.fetch` is a drop-in `fetch`: on `402 Payment Required` it signs a USDC payment
(EIP-3009), retries, and returns the response. Also `cp.discover()` (reputation-
ranked), `cp.pay()`, `cp.getReputation()`, `cp.giveFeedback()`, `cp.balance()`.

---

## One core, many surfaces

| Surface | Package / path | What it is |
|---|---|---|
| **SDK** | [`@chainpe/sdk`](packages/chainpe-sdk) | Add payments + reputation to any app in 3 lines |
| **Agent tools** | [`@chainpe/ai-tools`](packages/chainpe-ai-tools) | Drop-in **Vercel AI SDK** + **LangChain** tools (`chainpeFetch`, `discoverService`) |
| **CLI** | [`@chainpe/cli`](packages/chainpe) | `chainpe fetch <url>` (curl-level pay) · `chainpe discover` · provider `init/start/register` |
| **Claude wallet** | [`chainpe-wallet-mcp`](packages/chainpe-wallet) | MCP extension — Claude gets an Avalanche x402 wallet (9 tools) |
| **Agent SDK** | [`@chainpe/agent`](packages/chainpe-agent) | Standalone LLM agent loop that discovers + pays |
| **Dashboard** | [`apps/dashboard`](apps/dashboard) | Next.js marketplace — browse ⭐-ranked services, register from MetaMask |
| **Facilitator** | [`services/chainpe-facilitator`](services/chainpe-facilitator) | Non-custodial x402 `verify`/`settle` service (Railway-ready) |
| **Indexer** | [`services/chainpe-indexer`](services/chainpe-indexer) | Watches contracts → Postgres → O(1) discovery + reputation API |

Same paid call works from a Vercel/LangChain agent, the CLI, and Claude — all settle
on Avalanche. See [`examples/agent-surfaces`](examples/agent-surfaces).

---

## The differentiators

### Agent-to-agent marketplace + reputation
Agents that get paid to do real work, and agents that hire them. In
[`examples/seller-agents`](examples/seller-agents), a buyer agent discovers two
LLM-backed seller agents (ranked by ⭐), **hires both in sequence**, pays each in
USDC, composes the result — and every paid call bumps the seller's ERC-8004 score.
ERC-8004 blocks self-feedback, so reputation only accrues from real counterparties.

### Gasless, programmable spending (the chain blocks an overspend)
[`PolicyVault.sol`](contracts/contracts/PolicyVault.sol) lets an owner set on-chain
limits (`maxPerCall`, `dailyCap`, `totalBudget`, `expiry`, allowlist) and grant a
**session key**. The agent only *signs* spends (EIP-712); a relayer submits them and
pays gas — so the agent spends **gaslessly**. An over-cap or revoked attempt is
**rejected on-chain**. Demo: [`examples/policy-vault`](examples/policy-vault).

### Avalanche-native
Sub-cent settlement + ~1–2s deterministic finality make pay-per-request economics
real ([`docs/WHY-AVALANCHE.md`](docs/WHY-AVALANCHE.md), with a live reproducible
benchmark). Plus **cross-L1 hiring over ICM/Teleporter**
([`contracts/contracts/icm`](contracts/contracts/icm)) — an agent on one Avalanche
L1 can hire a service on another, no bridges.

---

## Architecture

```
                            ┌──────────────────────────────────────────┐
  Consumers / agents        │            Avalanche C-Chain             │
  ┌────────────────┐        │  ┌────────────────────────────────────┐  │
  │ @chainpe/sdk   │        │  │ ChainPeRegistry  (services)        │  │
  │ ai-tools       │ discover│  │ ERC-8004 Identity/Reputation       │  │
  │ CLI · MCP      │────────▶│  │ PolicyVault  (gasless policies)    │  │
  │ dashboard      │  rate   │  │ ICM sender/receiver (cross-L1)     │  │
  └───────┬────────┘        │  └────────────────────────────────────┘  │
          │ x402 fetch (USDC EIP-3009)        ▲ settle (pays gas)       │
          ▼                                   │                         │
  ┌────────────────┐   402   ┌──────────────┐ │   ┌───────────────────┐ │
  │ Provider proxy │◀───────▶│  Facilitator │─┘   │ Indexer → Postgres│ │
  │ (@chainpe/cli) │  pay    │ (non-custodial)     │  → REST (O(1))    │ │
  └───────┬────────┘        └──────────────┘      └───────────────────┘ │
          ▼ forward                              └──────────────────────┘
  Provider backend / seller agent (real work)
```

Pay flow: payer signs an EIP-3009 `transferWithAuthorization`; the facilitator
submits it on Avalanche and pays the gas. Settlement is USDC; finality ~1–2s.

---

## For providers — monetize any API

```bash
npm install -g @chainpe/cli
chainpe init      # interactive setup → ~/.chainpe/config.json
chainpe start     # launch the x402 payment proxy
chainpe register  # publish on-chain (USDC fee) — browser/MetaMask or pasted key
```

No backend changes; the proxy never holds funds or needs your private key. The
provider proxy also advertises its ERC-8004 `agentId` on the 402 so buyers can rate
it without scanning the registry. CLI: `init · start · register · deregister · list
· status · fetch · discover`.

## For consumers — use paid APIs from Claude

Install the MCP extension (`npm run build:mcpb` in `packages/chainpe-wallet` →
`chainpe.mcpb`, double-click into Claude Desktop). Claude gets an Avalanche wallet:
`search_bazaar` (⭐-ranked), `x402_fetch` (auto-pays + auto-rates), `pay`,
`transfer_usdc/avax`, `give_feedback`, `spending_report`, `check_balance`,
`request_funding`.

---

## On-chain contracts (Avalanche)

| Contract | Purpose |
|---|---|
| `ChainPeRegistry.sol` | Service marketplace registry (register/update/deregister, paginated `getServices`, USDC fee, events, optional `agentId`) |
| ERC-8004 Identity / Reputation / Validation | Portable agent identity + reputation (vendored reference contracts) |
| `PolicyVault.sol` | Gasless, policy-bounded agent spending (session key + relay) |
| `icm/ChainPeICM{Sender,Receiver}.sol` | Cross-L1 payment intents over ICM/Teleporter |

Solidity 0.8.28, OpenZeppelin, Hardhat. **44 passing tests.** Deploy:
[`docs/DEPLOY-ALL.md`](docs/DEPLOY-ALL.md).

| Network | chainId | USDC | Explorer |
|---|---|---|---|
| Fuji (testnet) | 43113 | `0x5425890298aed601595a70AB815c96711a31Bc65` | https://testnet.snowtrace.io |
| Avalanche (mainnet) | 43114 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | https://snowtrace.io |

---

## Repo layout

```
chainpe/
├── contracts/                  # Hardhat — Registry, ERC-8004, PolicyVault, ICM (44 tests)
├── packages/
│   ├── chainpe-sdk/            # @chainpe/sdk — payments in 3 lines (+ PolicyVaultClient)
│   ├── chainpe-ai-tools/       # @chainpe/ai-tools — Vercel AI SDK + LangChain tools
│   ├── chainpe/                # @chainpe/cli — provider proxy + consumer fetch/discover
│   ├── chainpe-wallet/         # chainpe-wallet-mcp — Claude MCP wallet (9 tools)
│   └── chainpe-agent/          # @chainpe/agent — standalone agent loop
├── services/
│   ├── chainpe-facilitator/    # non-custodial x402 verify/settle (Railway)
│   └── chainpe-indexer/        # events → Postgres → O(1) REST API
├── apps/dashboard/             # Next.js marketplace UI (browse + register)
├── examples/                   # agent-surfaces, seller-agents, policy-vault, avalanche-bench
└── docs/                       # PITCH, WHY-AVALANCHE, DEPLOY-ALL, BUILD-PLAN, DEPLOYMENTS
```

---

## Quickstart (local)

```bash
git clone https://github.com/SamyaDeb/ChainPe.git && cd ChainPe
npm install && npm run build
npm test                  # workspace tests
cd contracts && npm test  # 44 contract tests
```

Pay against live Fuji (needs a key with a little Fuji USDC):

```bash
export CHAINPE_PRIVATE_KEY=0x...
npx @chainpe/cli discover                 # browse ⭐-ranked services
npx @chainpe/cli fetch <service-endpoint> # auto-pays the 402 in USDC
```

---

## Docs

| Doc | What it covers |
|---|---|
| [`docs/PITCH.md`](docs/PITCH.md) | The 1-page pitch — problem, solution, demo, why Avalanche, proof |
| [`docs/WHY-AVALANCHE.md`](docs/WHY-AVALANCHE.md) | Measured finality + fees, ICM cross-L1, why this chain |
| [`docs/DEMO.md`](docs/DEMO.md) | Demo video storyboard + 60-second pitch |
| [`docs/DEPLOY-ALL.md`](docs/DEPLOY-ALL.md) | Batch deploy runbook (facilitator, indexer, dashboard, npm) |
| [`docs/BUILD-PLAN.md`](docs/BUILD-PLAN.md) | Phase-by-phase roadmap, conventions, gotchas |
| [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md) | Live contract addresses |

---

## License

MIT
