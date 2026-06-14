# ChainPe — demo storyboard & submission

Everything needed to record the demo video and assemble the grant submission.

**Screen layout (keep constant):** agent/Claude on the **left** · ChainPe logs in the
**middle** · Snowtrace on the wallet/contract on the **right**. Target length **3–4
min**. The 60-second pitch script is in [`PITCH.md`](PITCH.md#60-second-pitch).

## Pre-flight (before recording)

Deploy + fund per [`DEPLOY-ALL.md`](DEPLOY-ALL.md):
- Facilitator live at `CHAINPE_FACILITATOR_URL` (gas key funded with AVAX).
- 3 funded wallets: buyer (USDC) + 2 sellers; a PolicyVault owner/relayer.
- Dashboard running; `ANTHROPIC_API_KEY` set; Snowtrace tabs open on the contracts.

---

## Scene 1 — “Infra, not an app” (same payment, 3 surfaces) · ~45s

> **Say:** “The same paid call, from three different clients — all settling on Avalanche.”

1. **CLI:** `chainpe discover` → ⭐-ranked services. `chainpe fetch <url>` → logs show
   `402 → pay 0.01 USDC → 200`; print the Snowtrace tx.
2. **Vercel agent:** `npm run vercel -- "find a service and call it"` → tool calls
   `discoverService` then `chainpeFetch`; same settlement.
3. **Claude (MCP):** `search_bazaar` → `x402_fetch` on the same URL.

> **Land it:** “One core — `@chainpe/sdk` — many surfaces. This is infrastructure.”

## Scene 2 — Agent hires agents (+ reputation) · ~60s

> **Say:** “Now agents that get paid to do real work — and an agent that hires them.”

1. `cd examples/seller-agents && REGISTER=1 ./launch.sh` — two LLM seller agents go
   live + register on-chain (show the two seller terminals).
2. `npm run orchestrate -- "<topic>"` — buyer **discovers (ranked by ⭐)**, hires the
   research agent, then feeds its output to the digest agent. Middle pane shows each
   `pay` (USDC) + `rate` tx; right pane shows seller wallet balances + reputation
   ticking up on Snowtrace.
3. Re-run `chainpe discover` → the sellers' ⭐ scores increased.

> **Land it:** “Paid in USDC, reputation accrued on-chain — and ERC-8004 blocks
> self-rating, so it's real trust.”

## Scene 3 — Provider onboarding in 60s · ~30s

> **Say:** “Monetizing an existing API takes one minute.”

`chainpe init` → `chainpe start` (point an existing API behind it) → `chainpe
register` via **MetaMask** (or the dashboard `/register`). Show the service appear in
the dashboard marketplace, live, with its Snowtrace registration tx.

## Scene 4 — The chain blocks an overspend (the winning moment) · ~45s

> **Say:** “The owner sets on-chain spending limits; the agent spends gaslessly —
> and if it tries to overspend, the chain stops it.”

`cd examples/policy-vault && npm run demo`:
1. A **0.5 USDC** spend settles **gaslessly** (agent only signed; relayer paid gas) →
   Snowtrace tx.
2. A **2 USDC** spend (over the 1 USDC cap) → **reverted on-chain**; show the revert
   reason and the failed tx on Snowtrace.
3. Owner `revokeSession()` → next spend rejected.

> **Land it:** “On-chain guardrails, enforced by Avalanche — not a backend check.”

## Close · ~20s

Cut to the dashboard marketplace + the 60-second pitch tagline: *“ChainPe is how
agents transact on Avalanche.”* Show the live links slide.

---

## Slide outline (10 slides)

1. **Title** — ChainPe: x402 payment + reputation infra for the Avalanche agent economy.
2. **Problem** — agents can't pay per request, and can't tell who to trust.
3. **Solution** — pay-per-request USDC + ERC-8004 reputation; agents hold only USDC.
4. **3 lines** — the `cp.fetch(url)` code + “infra, not an app”.
5. **One core, many surfaces** — SDK · ai-tools · CLI · MCP · dashboard · facilitator · indexer.
6. **Agent-to-agent + reputation** — the seller-agents diagram.
7. **PolicyVault** — gasless spending; the chain blocks an overspend.
8. **Why Avalanche** — sub-cent fees + ~1–2s finality (measured) + ICM cross-L1.
9. **Proof** — deployed/verified on Fuji, 44 contract tests, live links.
10. **Ask** — grant to host the public facilitator + indexer + mainnet + SDK distribution.

---

## Live links (fill in after deploy)

| What | Link |
|---|---|
| ChainPeRegistry (verified) | https://testnet.snowtrace.io/address/0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6#code |
| ERC-8004 Reputation | https://testnet.snowtrace.io/address/0x89476DfEf9c72a668fa5E86f154B73EDB053aFe4 |
| **Dashboard** | https://chainpe-dashboard-production.up.railway.app |
| **Indexer API** | https://chainpe-indexer-production.up.railway.app/services |
| Facilitator | _pending — needs funded key + Railway plan headroom_ |
| npm — `@chainpe/sdk` | _publish: `npm run publish:sdk` (needs npm login + @chainpe org)_ |
| npm — `@chainpe/ai-tools` | _publish: `npm run publish:ai-tools`_ |
| Demo video | _record per this storyboard_ |

> Update these in `README.md` and [`DEPLOYMENTS.md`](DEPLOYMENTS.md) once the batch
> deploy ([`DEPLOY-ALL.md`](DEPLOY-ALL.md)) is run.
