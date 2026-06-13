# ChainPe — Deployed Contracts

## Avalanche Fuji (testnet, chainId 43113)

Deployed 2026-06-13. Deployer / owner: `0x8cC8dADfAd2D39659314106bAf4Da10B3BA38A36`.

| Contract | Address | Explorer |
|---|---|---|
| **ChainPeRegistry** | `0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6` | [Snowtrace ✓verified](https://testnet.snowtrace.io/address/0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6#code) |
| ERC-8004 IdentityRegistry | `0x56FEc2359fcDfFa6FA1D3a8AB3b708Ff698161D5` | [Snowtrace](https://testnet.snowtrace.io/address/0x56FEc2359fcDfFa6FA1D3a8AB3b708Ff698161D5) |
| ERC-8004 ReputationRegistry | `0x89476DfEf9c72a668fa5E86f154B73EDB053aFe4` | [Snowtrace](https://testnet.snowtrace.io/address/0x89476DfEf9c72a668fa5E86f154B73EDB053aFe4) |
| ERC-8004 ValidationRegistry | `0xd8810c97B462FbD6b3706C12F588c58546f8159c` | [Snowtrace](https://testnet.snowtrace.io/address/0xd8810c97B462FbD6b3706C12F588c58546f8159c) |

**ChainPeRegistry config:**
- Fee token: USDC `0x5425890298aed601595a70AB815c96711a31Bc65` (Fuji, Circle)
- Registration fee: `0.1 USDC` (100000 atomic) — settable by owner via `setRegistrationFee`
- Identity registry linked: yes (the ERC-8004 IdentityRegistry above)

The ERC-8004 registries are the official reference contracts deployed behind ERC-1967 (UUPS) proxies.

## Client configuration

Point clients at the registry:

```bash
# Provider CLI (~/.chainpe/config.json → registryAddress) or env:
export CHAINPE_REGISTRY_ADDRESS=0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6

# Consumer wallet MCP / agent:
export CHAINPE_REGISTRY_ADDRESS=0x91677a35599f052E99Ed0ab9E45c17E736a22Bf6
export ERC8004_IDENTITY_REGISTRY=0x56FEc2359fcDfFa6FA1D3a8AB3b708Ff698161D5
export ERC8004_REPUTATION_REGISTRY=0x89476DfEf9c72a668fa5E86f154B73EDB053aFe4
```

Raw deployment records: `contracts/deployments/fuji.json`, `contracts/deployments/fuji-erc8004.json`.

## Avalanche Mainnet (43114)

Not yet deployed. Use `npm run deploy:erc8004:mainnet` then `npm run deploy:mainnet` from `contracts/` with a funded `DEPLOYER_PRIVATE_KEY`.
