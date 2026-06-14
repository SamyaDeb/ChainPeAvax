/**
 * ChainPe x402 Facilitator — standalone, non-custodial settlement service.
 *
 * Implements the x402 facilitator HTTP contract (`/verify`, `/settle`,
 * `/supported`) for USDC (EIP-3009) payments on Avalanche. Point a ChainPe
 * provider proxy at it with `CHAINPE_FACILITATOR_URL`.
 *
 * NON-CUSTODIAL: the facilitator key only pays gas and relays the payer's
 * already-signed `transferWithAuthorization`. It never holds user funds and
 * cannot move money the payer did not authorize.
 *
 * Env:
 *   FACILITATOR_PRIVATE_KEY  (required) gas-paying key that submits settlements
 *   NETWORK                  "fuji" | "avalanche"  (default: fuji)
 *   RPC_URL                  optional RPC override
 *   PORT                     HTTP port (Railway injects this)
 */
import "dotenv/config";
import express, { type Request, type Response } from "express";
import cors from "cors";
import {
  createPublicClient,
  createWalletClient,
  http,
  publicActions,
  formatEther,
  type PublicClient,
  type WalletClient,
} from "viem";
import { avalanche, avalancheFuji } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import { verify, settle } from "x402/facilitator";
import { PaymentPayloadSchema, PaymentRequirementsSchema } from "x402/types";

type Network = "fuji" | "avalanche";

const NETWORK = (process.env.NETWORK === "avalanche" ? "avalanche" : "fuji") as Network;
const X402_NETWORK = NETWORK === "avalanche" ? "avalanche" : "avalanche-fuji";
const CHAIN = NETWORK === "avalanche" ? avalanche : avalancheFuji;
const RPC_URL =
  process.env.RPC_URL ??
  (NETWORK === "avalanche"
    ? "https://api.avax.network/ext/bc/C/rpc"
    : "https://api.avax-test.network/ext/bc/C/rpc");
const PORT = parseInt(process.env.PORT ?? "4500", 10);

const rawKey = process.env.FACILITATOR_PRIVATE_KEY;
if (!rawKey) {
  console.error("FATAL: FACILITATOR_PRIVATE_KEY is required (gas-paying settlement key).");
  process.exit(1);
}
const account = privateKeyToAccount((rawKey.startsWith("0x") ? rawKey : `0x${rawKey}`) as `0x${string}`);

const publicClient: PublicClient = createPublicClient({ chain: CHAIN, transport: http(RPC_URL) });
// settle() calls verify() which needs public actions (verifyTypedData) too.
const walletClient: WalletClient = createWalletClient({
  account,
  chain: CHAIN,
  transport: http(RPC_URL),
}).extend(publicActions) as unknown as WalletClient;

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "1mb" }));

  app.get("/", (_req: Request, res: Response) => {
    res.json({
      service: "chainpe-facilitator",
      description: "Non-custodial x402 verify + settle for USDC on Avalanche.",
      network: NETWORK,
      custodial: false,
      endpoints: ["/health", "/status", "/supported", "/verify", "/settle"],
    });
  });

  // Cheap liveness check (no RPC) — safe for frequent platform health polling.
  app.get("/health", (_req: Request, res: Response) => {
    res.json({
      status: "ok",
      service: "chainpe-facilitator",
      network: NETWORK,
      x402Network: X402_NETWORK,
      facilitator: account.address,
      custodial: false,
    });
  });

  // Operational status incl. the gas balance (reads the chain — use sparingly).
  app.get("/status", async (_req: Request, res: Response) => {
    const balance = await publicClient
      .getBalance({ address: account.address })
      .catch(() => null);
    res.json({
      service: "chainpe-facilitator",
      network: NETWORK,
      x402Network: X402_NETWORK,
      facilitator: account.address,
      gasBalanceAvax: balance != null ? formatEther(balance) : "unavailable",
      lowGas: balance != null ? balance < 10n ** 16n : null,
    });
  });

  app.get("/supported", (_req: Request, res: Response) => {
    res.json({ kinds: [{ x402Version: 1, scheme: "exact", network: X402_NETWORK }] });
  });

  app.post("/verify", async (req: Request, res: Response) => {
    try {
      const payload = PaymentPayloadSchema.parse(req.body.paymentPayload);
      const requirements = PaymentRequirementsSchema.parse(req.body.paymentRequirements);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await verify(publicClient as any, payload, requirements);
      res.json(result);
    } catch (err) {
      res.status(400).json({ isValid: false, invalidReason: `verify_error: ${(err as Error).message}` });
    }
  });

  app.post("/settle", async (req: Request, res: Response) => {
    try {
      const payload = PaymentPayloadSchema.parse(req.body.paymentPayload);
      const requirements = PaymentRequirementsSchema.parse(req.body.paymentRequirements);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await settle(walletClient as any, payload, requirements);
      res.json(result);
    } catch (err) {
      res.status(400).json({
        success: false,
        errorReason: "settle_error",
        transaction: "",
        network: X402_NETWORK,
        errorMessage: (err as Error).message,
      });
    }
  });

  return app;
}

async function main() {
  const balance = await publicClient.getBalance({ address: account.address }).catch(() => 0n);
  createApp().listen(PORT, () => {
    console.log(`ChainPe facilitator listening on :${PORT}`);
    console.log(`  network:     ${NETWORK} (${X402_NETWORK})`);
    console.log(`  facilitator: ${account.address}`);
    console.log(`  gas balance: ${formatEther(balance)} AVAX`);
    console.log(`  endpoints:   GET /health · GET /supported · POST /verify · POST /settle`);
    if (balance < 10n ** 16n) {
      console.warn("  ⚠ Low AVAX — top up the facilitator so it can pay settlement gas.");
    }
  });
}

// Only auto-start when run directly (not when imported by tests).
if (process.env.NODE_ENV !== "test") {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
