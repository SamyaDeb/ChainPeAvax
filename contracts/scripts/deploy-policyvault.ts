/**
 * Deploy PolicyVault to an Avalanche C-Chain network.
 *
 * Usage:
 *   npx hardhat run scripts/deploy-policyvault.ts --network fuji
 *   npx hardhat run scripts/deploy-policyvault.ts --network avalanche
 *
 * Required env (gitignored .env — NEVER hardcode):
 *   DEPLOYER_PRIVATE_KEY   funded deployer key
 * Optional env:
 *   FEE_TOKEN_ADDRESS / USDC_ADDRESS   ERC-20 the vault holds (defaults to the
 *                                      canonical USDC for the target network)
 *
 * Writes the deployed address to deployments/<network>-policyvault.json.
 */
import { ethers, network } from "hardhat";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const DEFAULT_USDC: Record<number, string> = {
  43113: "0x5425890298aed601595a70AB815c96711a31Bc65", // Fuji USDC
  43114: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", // Avalanche mainnet USDC
};

async function main() {
  const [deployer] = await ethers.getSigners();
  const net = await ethers.provider.getNetwork();
  const chainId = Number(net.chainId);

  const token =
    process.env.USDC_ADDRESS ?? process.env.FEE_TOKEN_ADDRESS ?? DEFAULT_USDC[chainId];
  if (!token) {
    throw new Error(`No USDC_ADDRESS set and no default USDC for chainId ${chainId}.`);
  }

  console.log(`\nDeploying PolicyVault to ${network.name} (chainId ${chainId})`);
  console.log(`  Deployer: ${deployer.address}`);
  console.log(`  Token:    ${token}`);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`  Balance:  ${ethers.formatEther(balance)} AVAX\n`);

  const Factory = await ethers.getContractFactory("PolicyVault");
  const vault = await Factory.deploy(token);
  await vault.waitForDeployment();
  const address = await vault.getAddress();

  console.log("========================================");
  console.log("  PolicyVault deployed");
  console.log("========================================");
  console.log(`  Address: ${address}`);
  console.log(`  Network: ${network.name} (${chainId})`);

  const dir = join(__dirname, "..", "deployments");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const out = {
    network: network.name,
    chainId,
    policyVault: address,
    token,
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
  };
  writeFileSync(
    join(dir, `${network.name}-policyvault.json`),
    JSON.stringify(out, null, 2) + "\n"
  );
  console.log(`\n  Saved -> deployments/${network.name}-policyvault.json`);
  console.log(`\n  Verify with:`);
  console.log(`  npx hardhat verify --network ${network.name} ${address} ${token}\n`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
