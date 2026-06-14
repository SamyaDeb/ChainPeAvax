import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type {
  ChainPeICMSender,
  ChainPeICMReceiver,
  MockTeleporterMessenger,
} from "../typechain-types";

const SERVICE_ID = ethers.id("research-agent"); // bytes32
const DEST_BLOCKCHAIN = ethers.id("c-chain"); // bytes32

describe("ChainPe ICM (Teleporter cross-L1 payment intent)", () => {
  async function deployFixture() {
    const [buyer, payTo, other] = await ethers.getSigners();

    const Messenger = await ethers.getContractFactory("MockTeleporterMessenger");
    const messenger = (await Messenger.deploy()) as unknown as MockTeleporterMessenger;
    await messenger.waitForDeployment();
    const messengerAddr = await messenger.getAddress();

    const Receiver = await ethers.getContractFactory("ChainPeICMReceiver");
    const receiver = (await Receiver.deploy(messengerAddr)) as unknown as ChainPeICMReceiver;
    await receiver.waitForDeployment();

    const Sender = await ethers.getContractFactory("ChainPeICMSender");
    const sender = (await Sender.deploy(messengerAddr)) as unknown as ChainPeICMSender;
    await sender.waitForDeployment();

    return { messenger, receiver, sender, buyer, payTo, other };
  }

  it("delivers a payment intent across L1s and the receiver records it", async () => {
    const { receiver, sender, buyer, payTo } = await loadFixture(deployFixture);
    const amount = ethers.parseUnits("0.5", 6);

    await expect(
      sender
        .connect(buyer)
        .sendPaymentIntent(
          DEST_BLOCKCHAIN,
          await receiver.getAddress(),
          SERVICE_ID,
          payTo.address,
          amount,
          200_000
        )
    )
      .to.emit(sender, "PaymentIntentSent")
      .and.to.emit(receiver, "CrossChainPaymentIntent")
      .withArgs(
        await (await ethers.getContractAt("MockTeleporterMessenger", await receiver.messenger()))
          .MOCK_SOURCE_BLOCKCHAIN_ID(),
        buyer.address,
        payTo.address,
        amount,
        SERVICE_ID,
        await sender.getAddress()
      );

    expect(await receiver.intentCount()).to.equal(1n);
    const intent = await receiver.intents(0);
    expect(intent.buyer).to.equal(buyer.address);
    expect(intent.payTo).to.equal(payTo.address);
    expect(intent.amount).to.equal(amount);
    expect(intent.serviceId).to.equal(SERVICE_ID);
    expect(intent.originSender).to.equal(await sender.getAddress());
  });

  it("rejects a direct receive not coming from the Teleporter messenger", async () => {
    const { receiver, other, buyer, payTo } = await loadFixture(deployFixture);
    const payload = ethers.AbiCoder.defaultAbiCoder().encode(
      ["bytes32", "address", "uint256", "address"],
      [SERVICE_ID, payTo.address, 1n, buyer.address]
    );
    await expect(
      receiver
        .connect(other)
        .receiveTeleporterMessage(DEST_BLOCKCHAIN, other.address, payload)
    ).to.be.revertedWith("only teleporter");
  });

  it("rejects a zero messenger in the constructors", async () => {
    const Sender = await ethers.getContractFactory("ChainPeICMSender");
    await expect(Sender.deploy(ethers.ZeroAddress)).to.be.revertedWith("messenger=0");
    const Receiver = await ethers.getContractFactory("ChainPeICMReceiver");
    await expect(Receiver.deploy(ethers.ZeroAddress)).to.be.revertedWith("messenger=0");
  });
});
