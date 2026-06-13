/**
 * Deploy ChainPeRegistry to an Avalanche C-Chain network.
 *
 * Usage:
 *   npm run deploy:fuji        # Avalanche Fuji testnet (chainId 43113)
 *   npm run deploy:mainnet     # Avalanche mainnet  (chainId 43114)
 *
 * Required env (gitignored .env — NEVER hardcode):
 *   DEPLOYER_PRIVATE_KEY   funded deployer key
 * Optional env:
 *   FEE_TOKEN_ADDRESS      ERC-20 used for the registration fee (defaults to the
 *                          canonical USDC for the target network)
 *   FEE_RECIPIENT          treasury receiving fees (defaults to deployer)
 *   REGISTRATION_FEE_USDC  human fee, e.g. "1.0" (defaults to "1.0")
 *   IDENTITY_REGISTRY      ERC-8004 Identity Registry (defaults to 0 / unset)
 *
 * Writes the deployed address to deployments/<network>.json.
 */
import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

// Canonical USDC (Circle native) per Avalanche network. Re-verify before mainnet.
const DEFAULT_USDC: Record<number, string> = {
  43113: "0x5425890298aed601595a70AB815c96711a31Bc65", // Fuji USDC
  43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // Avalanche mainnet USDC
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const feeToken = process.env.FEE_TOKEN_ADDRESS ?? DEFAULT_USDC[chainId];
  if (!feeToken) {
    throw new Error(
      `No FEE_TOKEN_ADDRESS set and no default USDC known for chainId ${chainId}.`
    );
  }
  const feeRecipient = process.env.FEE_RECIPIENT ?? deployer.address;
  const feeHuman = process.env.REGISTRATION_FEE_USDC ?? "1.0";
  const registrationFee = ethers.parseUnits(feeHuman, 6); // USDC = 6 decimals
  const identityRegistry =
    process.env.IDENTITY_REGISTRY ?? ethers.ZeroAddress;

  console.log(`\nDeploying ChainPeRegistry to ${network.name} (chainId ${chainId})`);
  console.log(`  Deployer:        ${deployer.address}`);
  console.log(`  Fee token:       ${feeToken}`);
  console.log(`  Fee recipient:   ${feeRecipient}`);
  console.log(`  Registration fee:${feeHuman} (${registrationFee} atomic)`);
  console.log(`  Identity reg:    ${identityRegistry}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Deployer balance:${ethers.formatEther(balance)} AVAX\n`);

  const Factory = await ethers.getContractFactory("ChainPeRegistry");
  const registry = await Factory.deploy(
    feeToken,
    feeRecipient,
    registrationFee,
    identityRegistry,
    deployer.address
  );
  await registry.waitForDeployment();
  const address = await registry.getAddress();

  console.log("========================================");
  console.log("  ChainPeRegistry deployed");
  console.log("========================================");
  console.log(`  Address: ${address}`);
  console.log(`  Network: ${network.name} (${chainId})`);

  const dir = join(__dirname, "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = {
    network: network.name,
    chainId,
    chainPeRegistry: address,
    feeToken,
    feeRecipient,
    registrationFee: registrationFee.toString(),
    identityRegistry,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  const file = join(dir, `${network.name}.json`);
  writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`\n  Saved -> deployments/${network.name}.json`);
  console.log(`\n  Verify with:`);
  console.log(
    `  npx hardhat verify --network ${network.name} ${address} ${feeToken} ${feeRecipient} ${registrationFee} ${identityRegistry} ${deployer.address}\n`
  );
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
