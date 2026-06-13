// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/**
 * @title MockUSDC
 * @notice 6-decimal ERC-20 used only in tests/local dev to stand in for USDC.
 *         NOT for production use.
 */
contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USD Coin", "USDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    /// @notice Mint test tokens to any address.
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
