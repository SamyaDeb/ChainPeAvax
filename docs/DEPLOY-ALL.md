# ChainPe — batch deployment runbook

Everything that's code-complete but needs an outward-facing deploy or a funded
key. Run these together when ready. Order matters where noted (URLs feed forward).

Prereqs: `npm i -g @railway/cli && railway login` (and `vercel` if you use it for
the dashboard). Have ready:
- a **funded facilitator key** (AVAX for gas) — never reuse a fund-holding key,
- a wallet with **AVAX + USDC** on Fuji for registering/paying,
- (optional) `ANTHROPIC_API_KEY` for the seller-agent demo.

---

## 1. Facilitator → public URL (Phase 4, MUST)

```bash
cd services/chainpe-facilitator
railway init
railway variables --set FACILITATOR_PRIVATE_KEY=0x<funded-gas-key> --set NETWORK=fuji
railway up
railway domain                       # → https://<facilitator>.up.railway.app
curl https://<facilitator>/health    # { status: "ok", custodial: false }
curl https://<facilitator>/status    # gasBalanceAvax + lowGas
```

Full detail: `services/chainpe-facilitator/DEPLOY.md`. **Record the URL** — it's
`CHAINPE_FACILITATOR_URL` for every provider.

## 2. Indexer → Postgres + REST (Phase 4, STRETCH)

```bash
cd services/chainpe-indexer
railway init
railway add --database postgres                      # provides DATABASE_URL
railway variables --set NETWORK=fuji --set START_BLOCK=<registry-deploy-block>
railway up
railway domain                                       # → https://<indexer>.up.railway.app
curl https://<indexer>/services                      # ranked services + reputation
```

`START_BLOCK` = the ChainPeRegistry deploy block (fast cold start). **Record the
URL** — it's `INDEXER_URL` for the dashboard.

## 3. Dashboard → public site (Phase 5, MUST)

Vercel (root dir `apps/dashboard`) or Railway. Env:

```
NEXT_PUBLIC_NETWORK=fuji
INDEXER_URL=https://<indexer>     # optional; omit to read on-chain directly
```

```bash
cd apps/dashboard
vercel deploy --prod              # or: railway init && railway up && railway domain
```

Verify the marketplace lists live Fuji services and a browser register works.

## 4. Publish the SDK + tools to npm (Phase 1/2)

```bash
# from repo root, after `npm run build`
npm run publish:sdk         # @chainpe/sdk
npm run publish:ai-tools    # @chainpe/ai-tools
# optionally: npm run publish:cli && npm run publish:agent
# or all: npm run publish:all   (needs `npm login`, an @chainpe org + 2FA)
```

## 4b. PolicyVault → gasless spending demo (Phase 6, STRETCH)

```bash
cd contracts
DEPLOYER_PRIVATE_KEY=0x... npm run deploy:policyvault:fuji   # → VAULT_ADDRESS
npx hardhat verify --network fuji <VAULT_ADDRESS> 0x5425890298aed601595a70AB815c96711a31Bc65

cd ../examples/policy-vault && cp .env.example .env          # VAULT_ADDRESS + 3 distinct keys
npm install && npm run demo                                 # gasless spend + on-chain over-cap rejection
```

Needs the OWNER funded with USDC+AVAX and the RELAYER with AVAX (the SESSION key
needs nothing). Record the vault address in `docs/DEPLOYMENTS.md`.

## 5. Seller-agents demo (Phase 3 live)

Needs 3 funded wallets (buyer + 2 sellers; ERC-8004 blocks self-feedback) and an
LLM key. Point sellers at the hosted facilitator from step 1.

```bash
cd examples/seller-agents && cp .env.example .env   # fill keys + CHAINPE_FACILITATOR_URL
npm install
SELLER_KEY=$RESEARCH_PAYTO_KEY node mint-identity.mjs   # → RESEARCH_AGENT_ID
SELLER_KEY=$DIGEST_PAYTO_KEY   node mint-identity.mjs   # → DIGEST_AGENT_ID
REGISTER=1 ./launch.sh                                   # start + register sellers
npm run orchestrate -- "your topic"                     # buyer hires + pays both
```

## 6. Wire URLs back into the repo

After the deploys, update with the real URLs:
- `docs/DEPLOYMENTS.md` — facilitator + indexer + dashboard URLs.
- root `README.md` — live links (dashboard, facilitator, npm, Snowtrace).
- consumers' default `CHAINPE_FACILITATOR_URL` where documented.
