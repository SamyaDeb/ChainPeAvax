# ChainPe — Production Readiness

A decentralized x402 API marketplace on Avalanche C-Chain.

## Readiness checklist

| Criterion | Status | Notes |
|---|---|---|
| No TODO / FIXME / HACK in source | ✅ | Scanned `packages/*/src`, `contracts/contracts`, `contracts/scripts`. |
| No mock data / placeholders | ✅ | `MockUSDC` is test-only and clearly named. |
| No hardcoded secrets | ✅ | Keys only in gitignored `.env`; `0x…` matches in vendored ERC-8004 are ERC-7201 storage slots. |
| No TypeScript errors | ✅ | `tsc --noEmit` clean for all packages. |
| No lint errors | ✅ | `chainpe-wallet` eslint clean (0/0). |
| No build errors | ✅ | tsup builds all packages; Hardhat compiles all contracts. |
| Tests pass | ✅ | contracts **30** (100% line cov on `ChainPeRegistry`), wallet **62**. |
| Deployment works | ✅ | Deployed + **verified** on Fuji; see `DEPLOYMENTS.md`. |
| E2E validated | ✅ | Real `402 → pay → 200` + on-chain registration + reputation; see `E2E-REPORT.md`. |

## Verification commands

```bash
npm install                 # clean, no --legacy-peer-deps
npm run typecheck           # all packages
npm run build               # all packages
npm run test:wallet         # 62 tests
cd contracts && npm test    # 30 tests
cd packages/chainpe-wallet && npm run lint
```

## Environment setup

Copy `.env.example` → `.env` (gitignored). Key variables:

| Variable | Used by | Purpose |
|---|---|---|
| `DEPLOYER_PRIVATE_KEY` | `contracts/` (Hardhat) | Deploys contracts. Never committed. |
| `SNOWTRACE_API_KEY` | `contracts/` | Optional — Routescan verify works keyless. |
| `CHAINPE_REGISTRY_ADDRESS` | all | Deployed `ChainPeRegistry` address. |
| `CHAINPE_PRIVATE_KEY` | wallet MCP / agent | Consumer wallet key (OS keychain in the MCP). |
| `CHAINPE_FACILITATOR_URL` | provider | Hosted facilitator (see `services/chainpe-facilitator`). |
| `CHAINPE_FACILITATOR_KEY` / `--facilitator` | provider | Runs an in-process facilitator instead. |
| `ERC8004_REPUTATION_REGISTRY` | wallet / agent | Reputation registry for on-chain scoring. |
| `MAX_PER_CALL` / `MAX_PER_DAY` | wallet / agent | USDC spend limits. |

## Deployment guide (Avalanche)

```bash
cd contracts && npm install
# 1. ERC-8004 reputation registries (optional but recommended)
npm run deploy:erc8004          # Fuji   (or deploy:erc8004:mainnet)
# 2. ChainPeRegistry, linked to the Identity Registry from step 1
IDENTITY_REGISTRY=0x... REGISTRATION_FEE_USDC=0.1 npm run deploy:fuji
# 3. Verify
npm run verify:fuji
```

Addresses are written to `contracts/deployments/<network>.json` and `<network>-erc8004.json`.

## Architecture

```
Provider:  @chainpe/cli  ──(x402-express)──>  ChainPeRegistry.sol (Avalanche)
                │                                     ▲
                │  facilitator (hosted/in-process)    │ register/list (viem)
                ▼                                     │
Consumer:  chainpe-wallet-mcp / @chainpe/agent ──(x402-fetch, USDC EIP-3009)──> provider proxy
                │                                     │
                └── ERC-8004 Identity/Reputation registries (on-chain agent reputation)

Infra:     services/chainpe-facilitator — standalone non-custodial settlement service
```

## Production notes (non-blocking)

- **Mainnet:** deploy via the `:mainnet` scripts with a funded key; set a production registration fee and `feeRecipient` (treasury).
- **Facilitator:** for production, deploy `services/chainpe-facilitator` rather than using an in-process key.
- **Frontend:** static marketing/docs site. A wallet-connected dApp is optional future work.
- **`@chainpe/agent`** could add an eslint config to match `chainpe-wallet` (currently typecheck-gated).

## Docs

- `DEPLOYMENTS.md` — live contract addresses
- `E2E-REPORT.md` — end-to-end validation
- `PRODUCTION-READINESS.md` — this document
