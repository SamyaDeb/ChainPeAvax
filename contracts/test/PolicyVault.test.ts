import { expect } from "chai";
import { ethers } from "hardhat";
import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { PolicyVault, MockUSDC } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const USDC = (n: string) => ethers.parseUnits(n, 6);

describe("PolicyVault", () => {
  async function deployFixture() {
    const [owner, agent, relayer, provider, other] = await ethers.getSigners();

    const Usdc = await ethers.getContractFactory("MockUSDC");
    const usdc = (await Usdc.deploy()) as unknown as MockUSDC;
    await usdc.waitForDeployment();

    const Vault = await ethers.getContractFactory("PolicyVault");
    const vault = (await Vault.deploy(await usdc.getAddress())) as unknown as PolicyVault;
    await vault.waitForDeployment();

    // Owner funds the vault with 1000 USDC.
    await usdc.mint(owner.address, USDC("1000"));
    await usdc.connect(owner).approve(await vault.getAddress(), USDC("1000"));
    await vault.connect(owner).deposit(USDC("1000"));

    return { usdc, vault, owner, agent, relayer, provider, other };
  }

  async function setDefaultPolicy(
    vault: PolicyVault,
    owner: HardhatEthersSigner,
    agent: HardhatEthersSigner,
    overrides: Partial<{
      maxPerCall: bigint;
      dailyCap: bigint;
      totalBudget: bigint;
      expiry: number;
      allowlistOnly: boolean;
    }> = {}
  ) {
    const expiry = overrides.expiry ?? (await time.latest()) + 3600;
    await vault
      .connect(owner)
      .setPolicy(
        agent.address,
        overrides.maxPerCall ?? USDC("10"),
        overrides.dailyCap ?? USDC("20"),
        overrides.totalBudget ?? USDC("50"),
        expiry,
        overrides.allowlistOnly ?? false
      );
  }

  async function signSpend(
    vault: PolicyVault,
    signer: HardhatEthersSigner,
    owner: string,
    to: string,
    amount: bigint,
    nonce: bigint,
    deadline: number
  ) {
    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      name: "ChainPePolicyVault",
      version: "1",
      chainId,
      verifyingContract: await vault.getAddress(),
    };
    const types = {
      Spend: [
        { name: "owner", type: "address" },
        { name: "to", type: "address" },
        { name: "amount", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "deadline", type: "uint256" },
      ],
    };
    return signer.signTypedData(domain, types, { owner, to, amount, nonce, deadline });
  }

  describe("funding", () => {
    it("tracks deposits and withdrawals", async () => {
      const { vault, usdc, owner } = await loadFixture(deployFixture);
      expect(await vault.balanceOf(owner.address)).to.equal(USDC("1000"));
      await vault.connect(owner).withdraw(USDC("400"));
      expect(await vault.balanceOf(owner.address)).to.equal(USDC("600"));
      expect(await usdc.balanceOf(owner.address)).to.equal(USDC("400"));
      await expect(vault.connect(owner).withdraw(USDC("601"))).to.be.revertedWith(
        "insufficient balance"
      );
    });
  });

  describe("gasless spend within policy", () => {
    it("a relayer settles a session-signed spend; the agent pays no gas", async () => {
      const { vault, usdc, owner, agent, relayer, provider } =
        await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent);

      const deadline = (await time.latest()) + 600;
      const sig = await signSpend(
        vault,
        agent,
        owner.address,
        provider.address,
        USDC("5"),
        0n,
        deadline
      );

      const agentEthBefore = await ethers.provider.getBalance(agent.address);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), deadline, sig)
      )
        .to.emit(vault, "Spent")
        .withArgs(owner.address, provider.address, USDC("5"), relayer.address, 0n);

      // Provider got paid; vault balance + nonce updated; agent spent NO gas.
      expect(await usdc.balanceOf(provider.address)).to.equal(USDC("5"));
      expect(await vault.balanceOf(owner.address)).to.equal(USDC("995"));
      expect(await vault.nonces(owner.address)).to.equal(1n);
      expect(await ethers.provider.getBalance(agent.address)).to.equal(agentEthBefore);
    });
  });

  describe("on-chain policy enforcement", () => {
    it("rejects a spend over the per-call cap", async () => {
      const { vault, owner, agent, relayer, provider } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent, { maxPerCall: USDC("10") });
      const deadline = (await time.latest()) + 600;
      const sig = await signSpend(vault, agent, owner.address, provider.address, USDC("11"), 0n, deadline);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("11"), deadline, sig)
      ).to.be.revertedWith("over per-call cap");
    });

    it("rejects a spend over the daily cap", async () => {
      const { vault, owner, agent, relayer, provider } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent, { maxPerCall: USDC("15"), dailyCap: USDC("20") });
      const d1 = (await time.latest()) + 600;
      const s1 = await signSpend(vault, agent, owner.address, provider.address, USDC("15"), 0n, d1);
      await vault.connect(relayer).spend(owner.address, provider.address, USDC("15"), d1, s1);
      const d2 = (await time.latest()) + 600;
      const s2 = await signSpend(vault, agent, owner.address, provider.address, USDC("15"), 1n, d2);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("15"), d2, s2)
      ).to.be.revertedWith("over daily cap");
    });

    it("rejects a spend over the total budget", async () => {
      const { vault, owner, agent, relayer, provider } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent, { totalBudget: USDC("8"), maxPerCall: USDC("10") });
      const d1 = (await time.latest()) + 600;
      const s1 = await signSpend(vault, agent, owner.address, provider.address, USDC("8"), 0n, d1);
      await vault.connect(relayer).spend(owner.address, provider.address, USDC("8"), d1, s1);
      const d2 = (await time.latest()) + 600;
      const s2 = await signSpend(vault, agent, owner.address, provider.address, USDC("1"), 1n, d2);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("1"), d2, s2)
      ).to.be.revertedWith("over total budget");
    });

    it("enforces the recipient allowlist when allowlistOnly is set", async () => {
      const { vault, owner, agent, relayer, provider, other } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent, { allowlistOnly: true });

      const d1 = (await time.latest()) + 600;
      const sBad = await signSpend(vault, agent, owner.address, other.address, USDC("5"), 0n, d1);
      await expect(
        vault.connect(relayer).spend(owner.address, other.address, USDC("5"), d1, sBad)
      ).to.be.revertedWith("recipient not allowlisted");

      await vault.connect(owner).setAllowlist(provider.address, true);
      const sOk = await signSpend(vault, agent, owner.address, provider.address, USDC("5"), 0n, d1);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d1, sOk)
      ).to.emit(vault, "Spent");
    });

    it("rejects an expired session and an expired auth deadline", async () => {
      const { vault, owner, agent, relayer, provider } = await loadFixture(deployFixture);
      const expiry = (await time.latest()) + 100;
      await setDefaultPolicy(vault, owner, agent, { expiry });

      // auth deadline in the past
      const past = (await time.latest()) - 1;
      const sPast = await signSpend(vault, agent, owner.address, provider.address, USDC("5"), 0n, past);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), past, sPast)
      ).to.be.revertedWith("auth expired");

      // advance past session expiry
      await time.increaseTo(expiry + 10);
      const d = (await time.latest()) + 600;
      const s = await signSpend(vault, agent, owner.address, provider.address, USDC("5"), 0n, d);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d, s)
      ).to.be.revertedWith("session expired");
    });

    it("rejects a bad session signature and replayed authorizations", async () => {
      const { vault, owner, agent, relayer, provider, other } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent);
      const d = (await time.latest()) + 600;

      // signed by the wrong key
      const bad = await signSpend(vault, other, owner.address, provider.address, USDC("5"), 0n, d);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d, bad)
      ).to.be.revertedWith("bad session sig");

      // valid once…
      const good = await signSpend(vault, agent, owner.address, provider.address, USDC("5"), 0n, d);
      await vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d, good);
      // …replay fails (nonce advanced)
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d, good)
      ).to.be.revertedWith("bad session sig");
    });

    it("rejects spends after the owner revokes the session", async () => {
      const { vault, owner, agent, relayer, provider } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent);
      await vault.connect(owner).revokeSession();
      const d = (await time.latest()) + 600;
      const sig = await signSpend(vault, agent, owner.address, provider.address, USDC("5"), 0n, d);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d, sig)
      ).to.be.revertedWith("session inactive");
    });

    it("rejects a spend exceeding the vault balance", async () => {
      const { vault, owner, agent, relayer, provider } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent, { maxPerCall: USDC("10") });
      await vault.connect(owner).withdraw(USDC("997")); // leave 3 USDC
      const d = (await time.latest()) + 600;
      const sig = await signSpend(vault, agent, owner.address, provider.address, USDC("5"), 0n, d);
      await expect(
        vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d, sig)
      ).to.be.revertedWith("insufficient vault balance");
    });
  });

  describe("views", () => {
    it("reports remaining daily + budget allowances", async () => {
      const { vault, owner, agent, relayer, provider } = await loadFixture(deployFixture);
      await setDefaultPolicy(vault, owner, agent, {
        dailyCap: USDC("20"),
        totalBudget: USDC("50"),
      });
      const d = (await time.latest()) + 600;
      const sig = await signSpend(vault, agent, owner.address, provider.address, USDC("5"), 0n, d);
      await vault.connect(relayer).spend(owner.address, provider.address, USDC("5"), d, sig);
      expect(await vault.dailyRemaining(owner.address)).to.equal(USDC("15"));
      expect(await vault.budgetRemaining(owner.address)).to.equal(USDC("45"));
    });
  });
});
