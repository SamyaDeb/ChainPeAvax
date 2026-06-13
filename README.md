# ChainPe

**Monetize any HTTP API with blockchain micropayments. Consume paid APIs directly from Claude and other AI tools — no accounts, no API keys.**

ChainPe is a decentralized API marketplace built on **Avalanche C-Chain**. API developers publish their services to an on-chain registry and gate every request with the [x402 protocol](https://www.x402.org/) — trustless, pay-per-request micropayments in **USDC**. Consumers discover and call those services by installing the ChainPe MCP extension into Claude Desktop or any MCP-compatible AI tool. Agent reputation is tracked via the **[ERC-8004](https://eips.ethereum.org/EIPS/eip-8004) Trustless Agents** registries.

---

## How It Works

```
LLM (Claude)              ChainPe Proxy (x402)            Your Backend API
     │                           │                               │
     │  GET /endpoint            │                               │
     │──────────────────────────>│                               │
     │  402 Payment Required     │                               │
     │<──────────────────────────│                               │
     │                           │                               │
     │  Signs USDC authorization │                               │
     │  (EIP-3009)               │                               │
     │  GET /endpoint            │  verify payment               │
     │  + X-PAYMENT              │──────────┐                    │
     │──────────────────────────>│          │ facilitator        │
     │                           │<─────────┘ settles on-chain    │
     │                           │  forward to backend           │
     │                           │──────────────────────────────>│
     │  200 + data               │  200 + data                   │
     │<──────────────────────────│<──────────────────────────────│
```

The payer signs an EIP-3009 `transferWithAuthorization`; a facilitator submits it on Avalanche and pays the gas. Settlement is USDC, finality is ~1 second.

---

## For API Developers — Publish & Monetize

Register any existing HTTP API in two commands. No changes to your backend required.

```bash
npm install -g @chainpe/cli
chainpe init      # interactive setup → ~/.chainpe/config.json
chainpe start     # launch the x402 payment proxy
chainpe register  # publish your service on-chain (USDC fee)
```

`chainpe init` collects your service name, description, tags, backend URL, price (USDC), your **Avalanche wallet address** (`0x…`, receives payments), proxy port, and network (`fuji`/`avalanche`). The proxy never holds your funds or needs your private key.

### CLI Reference

| Command | What it does |
|---|---|
| `chainpe init` | Interactive setup — creates `~/.chainpe/config.json` |
| `chainpe start` | Start the x402 payment proxy (`--facilitator <key>` to self-host one) |
| `chainpe register` | Publish / update your service on the Avalanche registry |
| `chainpe deregister` | Remove your service from the registry |
| `chainpe list` | List all services registered on-chain |
| `chainpe status` | Show configuration, balances, and registration status |

Signing the registration transaction uses a private key (pasted into a hidden prompt); it is never written to disk.

---

## For Consumers — Use Paid APIs from Claude

Install the ChainPe MCP extension into Claude Desktop. Claude gets an Avalanche wallet, discovers services registered on-chain, and pays for them automatically within your configured budget.

1. Build the bundle: `npm run build:mcpb` in `packages/chainpe-wallet` → produces `chainpe.mcpb`
2. Double-click the `.mcpb` file — Claude Desktop installs it
3. Settings → Extensions → ChainPe → fill in your wallet **private key** (`0x…`, stored in the OS keychain) and spending limits

| Config field | Default | Description |
|---|---|---|
| Wallet private key | — | `0x…`, stored in the OS keychain |
| Network | `fuji` | `fuji` (testnet) or `avalanche` (mainnet) |
| Max per payment | `0.10 USDC` | Hard cap per single API call |
| Max per day | `20.00 USDC` | Daily spending limit |
| Registry address | — | `ChainPeRegistry` contract address on Avalanche |

### Tools Claude gets

| Tool | Description |
|---|---|
| `search_bazaar` | Discover services on the ChainPe Avalanche registry |
| `x402_fetch` | Call a service URL — auto-handles 402, signs USDC payment, retries |
| `check_balance` | View USDC + AVAX balance and wallet address |
| `pay` | Sign an x402 USDC payment authorization |
| `transfer_usdc` | Send USDC to any Avalanche address |
| `transfer_avax` | Send native AVAX (for gas) |
| `spending_report` | Review today's spend against limits |
| `request_funding` | Generate an EIP-681 top-up link |

---

## On-Chain Contracts (Avalanche)

> **Live on Fuji:** `ChainPeRegistry` at [`0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6`](https://testnet.snowtrace.io/address/0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6#code) (verified). Full address list in [`docs/DEPLOYMENTS.md`](docs/DEPLOYMENTS.md).

| Contract | Purpose |
|---|---|
| `ChainPeRegistry.sol` | Service marketplace registry (register / update / deregister / paginated `getServices`) |
| ERC-8004 Identity / Reputation / Validation | Portable agent identity + reputation (vendored reference contracts) |

`ChainPeRegistry` (Solidity 0.8.28, OpenZeppelin `Ownable2Step` + `ReentrancyGuard`): charges a USDC registration fee via `approve` + `transferFrom`, emits `ServiceRegistered` / `ServiceUpdated` / `ServiceDeregistered` events, and links each service to an optional ERC-8004 `agentId`. Discovery uses events + the on-chain `getServices(offset, limit)` view — no off-chain indexer required.

| Network | chainId | USDC | Explorer |
|---|---|---|---|
| Fuji (testnet) | 43113 | `0x5425890298aed601595a70AB815c96711a31Bc65` | https://testnet.snowtrace.io |
| Avalanche (mainnet) | 43114 | `0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E` | https://snowtrace.io |

Deploy with Hardhat:

```bash
cd contracts
npm install
npm run deploy:erc8004 --network fuji   # optional: agent reputation registries
npm run deploy:fuji                      # ChainPeRegistry (set IDENTITY_REGISTRY to link)
```

The deployer key is read from a gitignored `.env` (`DEPLOYER_PRIVATE_KEY`) — never hardcoded.

---

## Architecture

```
chainpe/
├── contracts/                          # Hardhat (Solidity, Avalanche)
│   ├── contracts/
│   │   ├── ChainPeRegistry.sol         # service registry
│   │   ├── erc8004/                    # vendored ERC-8004 reference contracts
│   │   └── mocks/MockUSDC.sol          # test-only USDC
│   ├── scripts/                        # deploy / verify
│   └── test/                           # 30 tests (Hardhat + ethers)
│
├── packages/
│   ├── chainpe/                        # Provider CLI & x402 proxy (@chainpe/cli)
│   │   └── src/
│   │       ├── cli.ts                  # init / start / register / deregister / list / status
│   │       ├── chains.ts               # Avalanche network constants
│   │       ├── evm.ts                  # viem balances / address helpers
│   │       ├── registry.ts             # viem ChainPeRegistry client
│   │       └── proxy/
│   │           ├── server.ts           # x402-express reverse proxy
│   │           └── localFacilitator.ts # optional in-process facilitator
│   │
│   ├── chainpe-wallet/                 # MCP extension for Claude Desktop (chainpe-wallet-mcp)
│   │   └── src/
│   │       ├── server.ts               # MCP server (stdio JSON-RPC)
│   │       ├── clients.ts              # viem signer + x402-fetch
│   │       ├── chainpe-registry.ts     # on-chain discovery (read-only)
│   │       └── tools/                  # search_bazaar, x402_fetch, pay, transfer_*, …
│   │
│   └── chainpe-agent/                  # Standalone AI agent SDK (@chainpe/agent)
│
├── examples/                           # sample backends + Railway deploy configs
└── frontend/                           # static landing + docs site
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language | TypeScript (ESM), Node.js ≥18 |
| Blockchain | Avalanche C-Chain (Fuji / Mainnet) |
| Smart contracts | Solidity 0.8.28, OpenZeppelin, Hardhat |
| Payment protocol | x402 (Coinbase) — `x402`, `x402-express`, `x402-fetch` |
| Token | USDC (EIP-3009 `transferWithAuthorization`) |
| Web3 client | viem (runtime), ethers v6 (contracts/Hardhat) |
| Agent reputation | ERC-8004 (Trustless Agents) |
| MCP protocol | `@modelcontextprotocol/sdk` |
| CLI tooling | Commander, `@clack/prompts`, Chalk |
| Security | OS keychain for key storage (agent), gitignored `.env` |
| Build | tsup, npm workspaces |

---

## Local Development

```bash
git clone https://github.com/SamyaDeb/ChainPe.git
cd ChainPe
npm install
npm run build

# Start an example backend
node examples/weather-api.mjs

# In a second terminal — configure & start the proxy
chainpe init
chainpe start

# Register on Avalanche Fuji
chainpe register
```

To build the MCP extension bundle:

```bash
cd packages/chainpe-wallet
npm run build
npm run build:mcpb   # produces chainpe.mcpb
```

---

## License

MIT
