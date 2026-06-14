// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ITeleporterReceiver} from "./ITeleporter.sol";

/**
 * @title ChainPeICMReceiver
 * @notice Receives ChainPe payment intents from another Avalanche L1 over ICM
 * (Teleporter) and records them. Deployed on the L1 where the service lives
 * (e.g. the C-Chain). Only the local Teleporter messenger may deliver messages.
 */
contract ChainPeICMReceiver is ITeleporterReceiver {
    address public immutable messenger;

    struct Intent {
        bytes32 sourceBlockchainID;
        address originSender; // the ChainPeICMSender on the source L1
        address buyer; // who initiated the intent on the source L1
        address payTo;
        uint256 amount;
        bytes32 serviceId;
    }

    Intent[] public intents;

    event CrossChainPaymentIntent(
        bytes32 indexed sourceBlockchainID,
        address indexed buyer,
        address indexed payTo,
        uint256 amount,
        bytes32 serviceId,
        address originSender
    );

    constructor(address messenger_) {
        require(messenger_ != address(0), "messenger=0");
        messenger = messenger_;
    }

    /// @inheritdoc ITeleporterReceiver
    function receiveTeleporterMessage(
        bytes32 sourceBlockchainID,
        address originSenderAddress,
        bytes calldata message
    ) external {
        require(msg.sender == messenger, "only teleporter");

        (bytes32 serviceId, address payTo, uint256 amount, address buyer) = abi.decode(
            message,
            (bytes32, address, uint256, address)
        );

        intents.push(
            Intent({
                sourceBlockchainID: sourceBlockchainID,
                originSender: originSenderAddress,
                buyer: buyer,
                payTo: payTo,
                amount: amount,
                serviceId: serviceId
            })
        );

        emit CrossChainPaymentIntent(
            sourceBlockchainID,
            buyer,
            payTo,
            amount,
            serviceId,
            originSenderAddress
        );
    }

    function intentCount() external view returns (uint256) {
        return intents.length;
    }
}
