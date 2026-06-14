// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {
    ITeleporterMessenger,
    TeleporterMessageInput,
    TeleporterFeeInfo
} from "./ITeleporter.sol";

/**
 * @title ChainPeICMSender
 * @notice Sends a ChainPe payment intent from one Avalanche L1 to a
 * {ChainPeICMReceiver} on another L1, over Avalanche Interchain Messaging (ICM /
 * Teleporter). This lets an agent living on its own L1 hire a service registered
 * on the C-Chain (or any other L1) without leaving Avalanche.
 *
 * The intent is the cross-chain trigger; settlement still happens in USDC via
 * x402 on the destination. The payload is `(serviceId, payTo, amount, buyer)`.
 */
contract ChainPeICMSender {
    ITeleporterMessenger public immutable messenger;

    event PaymentIntentSent(
        bytes32 indexed destinationBlockchainID,
        address indexed destinationAddress,
        bytes32 indexed serviceId,
        address payTo,
        uint256 amount,
        bytes32 messageID
    );

    constructor(address messenger_) {
        require(messenger_ != address(0), "messenger=0");
        messenger = ITeleporterMessenger(messenger_);
    }

    /**
     * @notice Send a payment intent to a receiver on another L1.
     * @param destinationBlockchainID the destination Avalanche L1 (blockchain id)
     * @param destinationAddress the {ChainPeICMReceiver} on that L1
     * @param serviceId the ChainPe service being hired
     * @param payTo the service's payout address (on the destination L1)
     * @param amount USDC amount (atomic) the buyer commits to pay
     * @param requiredGasLimit gas the receiver may use to process the message
     */
    function sendPaymentIntent(
        bytes32 destinationBlockchainID,
        address destinationAddress,
        bytes32 serviceId,
        address payTo,
        uint256 amount,
        uint256 requiredGasLimit
    ) external returns (bytes32 messageID) {
        bytes memory payload = abi.encode(serviceId, payTo, amount, msg.sender);

        messageID = messenger.sendCrossChainMessage(
            TeleporterMessageInput({
                destinationBlockchainID: destinationBlockchainID,
                destinationAddress: destinationAddress,
                feeInfo: TeleporterFeeInfo({feeTokenAddress: address(0), amount: 0}),
                requiredGasLimit: requiredGasLimit,
                allowedRelayerAddresses: new address[](0),
                message: payload
            })
        );

        emit PaymentIntentSent(
            destinationBlockchainID,
            destinationAddress,
            serviceId,
            payTo,
            amount,
            messageID
        );
    }
}
