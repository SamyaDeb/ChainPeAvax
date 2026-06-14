# ChainPe — the pitch

**x402 payment + reputation infrastructure for the Avalanche agent economy.**

---

## Problem

AI agents are starting to *buy* things — data, compute, other agents' work — but
they have no native way to pay per request. Today that means human-provisioned API
keys, prepaid accounts, and credit cards: none of which an autonomous agent can sign
up for, and none of which carry **trust**. An agent can't tell a good service from a
scam, and a provider can't monetize a single call without onboarding a human.

The missing layer is **payment + reputation rails built for machines**: pay-per-
request, settled in seconds, with portable on-chain trust — cheap enough that a
$0.01 call isn't eaten by fees.

## Solution

ChainPe is that layer, on Avalanche:

- **Providers** monetize any HTTP API (or AI agent) in one command — `chainpe
  init/start/register`. No backend changes; the proxy gates each request with x402
  and never holds funds.
- **Agents** discover, pay for, and rate services autonomously — `cp.fetch(url)`
  auto-pays a `402` in USDC (EIP-3009). Discovery is **ranked by reputation**.
- **A non-custodial facilitator** submits the payer's signed authorization and pays
  the gas, so **agents never need AVAX** — only USDC.
- **Every paid call builds ERC-8004 reputation.** Self-feedback is blocked on-chain,
  so scores reflect real counterparties.

It's **infrastructure, not an app**: one core powers an SDK, Vercel AI SDK +
LangChain tools, a CLI, the Claude MCP wallet, a marketplace dashboard, an indexer,
and a non-custodial facilitator.

```ts
const cp = new ChainPe({ privateKey, network: 'fuji' })
const res = await cp.fetch('https://api.example.com/paid')  // paid in USDC, settled on Avalanche
```

## Demo (what the judges see)

1. **Same payment, 3 surfaces** — pay one service from a Vercel/LangChain agent, the
   CLI, and Claude. *“This is infra, not a Claude plugin.”*
2. **Agent hires agents** — a buyer agent discovers two seller agents (ranked by ⭐),
   hires both, pays each in USDC; seller wallets + reputation go up on-chain.
3. **Provider onboarding in 60s** — `chainpe init/start/register` monetizes an
   existing API, live on Snowtrace.
4. **The chain blocks an overspend** — an agent exceeds its on-chain PolicyVault
   limit → **rejected live on Snowtrace**, gaslessly. ← the winning moment.

Full storyboard: [`DEMO.md`](DEMO.md).

## Why Avalanche

Pay-per-request needs **sub-cent fees** and **fast deterministic finality** — both
of which Avalanche delivers (measured, reproducible: [`WHY-AVALANCHE.md`](WHY-AVALANCHE.md)).
Native Circle USDC + EIP-3009 make the x402 *exact* scheme work; cheap gas makes
"the platform eats the gas, agents hold only USDC" sustainable; deterministic
finality underpins the PolicyVault guarantee; and **ICM/Teleporter** lets agents on
one L1 hire services on another without bridges.

## Proof

- **Deployed + verified on Fuji** — `ChainPeRegistry`
  [`0x9167…22Bf6`](https://testnet.snowtrace.io/address/0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6#code),
  ERC-8004 Identity/Reputation/Validation. Real `402 → pay → 200` settled on-chain.
- **44 contract tests** (registry, ERC-8004 wiring, PolicyVault over-cap reverts,
  ICM cross-L1) + workspace tests (SDK 22, wallet 62, ai-tools 6, facilitator 4,
  indexer 6), all green.
- **Live-verified reads** — the dashboard renders on-chain Fuji services; `chainpe
  discover` lists + ranks them by reputation.
- **Publishable** SDK + tools (`@chainpe/sdk`, `@chainpe/ai-tools`).

## The ask

An Avalanche x402 grant to harden and host the public infrastructure — the hosted
facilitator + indexer, mainnet deployment, and SDK distribution — so any developer
or agent can transact on Avalanche in three lines.

---

### 60-second pitch

> AI agents are starting to buy things, but they have no native way to pay per
> request — and no way to know who to trust. ChainPe is payment + reputation
> infrastructure for the Avalanche agent economy. A provider monetizes any API with
> one command; an agent pays for it in three lines of code — `cp.fetch(url)` signs a
> USDC payment and settles on Avalanche in about a second. A non-custodial
> facilitator pays the gas, so agents only ever hold USDC. Every paid call builds
> portable ERC-8004 reputation, and self-rating is blocked on-chain, so discovery is
> ranked by *real* trust. It's not a Claude plugin — the same core drives an SDK,
> Vercel and LangChain tools, a CLI, a marketplace dashboard, and Claude. Agents
> even hire other agents and pay them automatically. And with our PolicyVault, an
> owner sets on-chain spending limits and the agent spends gaslessly within them —
> if it tries to overspend, the chain rejects it, live. It's deployed and verified
> on Avalanche, with 44 passing contract tests. ChainPe is how agents transact on
> Avalanche.
