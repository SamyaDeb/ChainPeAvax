// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PolicyVault
 * @notice Programmable, gasless spending policies for agent payments in USDC.
 *
 * An owner deposits USDC and grants a scoped **session key** (held by their
 * agent) a policy: per-call cap, daily cap, total budget, expiry, and an
 * optional recipient allowlist. The agent only *signs* spend authorizations
 * (EIP-712); a relayer (e.g. the ChainPe facilitator) submits `spend(...)` and
 * pays the AVAX gas — so the agent spends **gaslessly**. Every constraint is
 * enforced **on-chain**: an over-cap or non-allowlisted attempt reverts, and the
 * owner can revoke the session at any time.
 *
 * This is the non-4337 path (see BUILD-PLAN §4.7): no smart-account/EIP-1271
 * complexity — just a vault that holds funds and releases them within policy.
 */
contract PolicyVault is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable token;

    struct Policy {
        address sessionKey; // scoped signer (the agent)
        uint256 maxPerCall; // max USDC per spend
        uint256 dailyCap; // max USDC per UTC day
        uint256 totalBudget; // lifetime cap for this session
        uint64 expiry; // unix timestamp after which the session is invalid
        bool allowlistOnly; // if true, `to` must be allowlisted
        bool active; // owner can flip off via revokeSession
    }

    /// owner => vault USDC balance
    mapping(address => uint256) public balanceOf;
    /// owner => active policy
    mapping(address => Policy) public policyOf;
    /// owner => recipient => allowed
    mapping(address => mapping(address => bool)) public allowlist;
    /// owner => lifetime spent under the current/last session
    mapping(address => uint256) public totalSpent;
    /// owner => UTC day index => spent that day
    mapping(address => mapping(uint256 => uint256)) public dailySpent;
    /// owner => spend nonce (single-use signatures, replay protection)
    mapping(address => uint256) public nonces;

    bytes32 private constant SPEND_TYPEHASH =
        keccak256(
            "Spend(address owner,address to,uint256 amount,uint256 nonce,uint256 deadline)"
        );

    event Deposited(address indexed owner, uint256 amount);
    event Withdrawn(address indexed owner, uint256 amount);
    event PolicySet(
        address indexed owner,
        address indexed sessionKey,
        uint256 maxPerCall,
        uint256 dailyCap,
        uint256 totalBudget,
        uint64 expiry,
        bool allowlistOnly
    );
    event AllowlistUpdated(address indexed owner, address indexed to, bool allowed);
    event SessionRevoked(address indexed owner, address indexed sessionKey);
    event Spent(
        address indexed owner,
        address indexed to,
        uint256 amount,
        address indexed relayer,
        uint256 nonce
    );

    constructor(address _token) EIP712("ChainPePolicyVault", "1") {
        require(_token != address(0), "token=0");
        token = IERC20(_token);
    }

    // ─── Funding ────────────────────────────────────────────────────────────

    /// @notice Deposit USDC into your vault (approve this contract first).
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "amount=0");
        token.safeTransferFrom(msg.sender, address(this), amount);
        balanceOf[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /// @notice Withdraw your own unspent USDC at any time.
    function withdraw(uint256 amount) external nonReentrant {
        require(amount <= balanceOf[msg.sender], "insufficient balance");
        balanceOf[msg.sender] -= amount;
        token.safeTransfer(msg.sender, amount);
        emit Withdrawn(msg.sender, amount);
    }

    // ─── Policy management (owner only, gas paid by owner) ──────────────────

    /// @notice Set/replace the session policy for your vault.
    function setPolicy(
        address sessionKey,
        uint256 maxPerCall,
        uint256 dailyCap,
        uint256 totalBudget,
        uint64 expiry,
        bool allowlistOnly
    ) external {
        require(sessionKey != address(0), "sessionKey=0");
        policyOf[msg.sender] = Policy({
            sessionKey: sessionKey,
            maxPerCall: maxPerCall,
            dailyCap: dailyCap,
            totalBudget: totalBudget,
            expiry: expiry,
            allowlistOnly: allowlistOnly,
            active: true
        });
        // A fresh session starts its lifetime budget from zero.
        totalSpent[msg.sender] = 0;
        emit PolicySet(
            msg.sender,
            sessionKey,
            maxPerCall,
            dailyCap,
            totalBudget,
            expiry,
            allowlistOnly
        );
    }

    function setAllowlist(address to, bool allowed) external {
        allowlist[msg.sender][to] = allowed;
        emit AllowlistUpdated(msg.sender, to, allowed);
    }

    /// @notice Immediately disable the session key.
    function revokeSession() external {
        Policy storage p = policyOf[msg.sender];
        p.active = false;
        emit SessionRevoked(msg.sender, p.sessionKey);
    }

    // ─── Gasless spend (submitted by any relayer) ───────────────────────────

    /**
     * @notice Release `amount` USDC from `owner`'s vault to `to`, authorized by
     * the owner's session key. Reverts unless every policy constraint holds.
     * The caller (relayer) pays gas; the session-key holder paid none.
     */
    function spend(
        address owner,
        address to,
        uint256 amount,
        uint256 deadline,
        bytes calldata sessionSig
    ) external nonReentrant {
        Policy memory p = policyOf[owner];
        require(p.active, "session inactive");
        require(block.timestamp <= p.expiry, "session expired");
        require(block.timestamp <= deadline, "auth expired");
        require(to != address(0), "to=0");
        require(amount > 0, "amount=0");
        require(amount <= p.maxPerCall, "over per-call cap");
        require(balanceOf[owner] >= amount, "insufficient vault balance");
        require(totalSpent[owner] + amount <= p.totalBudget, "over total budget");

        uint256 day = block.timestamp / 1 days;
        require(dailySpent[owner][day] + amount <= p.dailyCap, "over daily cap");

        if (p.allowlistOnly) {
            require(allowlist[owner][to], "recipient not allowlisted");
        }

        uint256 nonce = nonces[owner];
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(SPEND_TYPEHASH, owner, to, amount, nonce, deadline)
            )
        );
        require(ECDSA.recover(digest, sessionSig) == p.sessionKey, "bad session sig");

        // Effects before interaction.
        nonces[owner] = nonce + 1;
        totalSpent[owner] += amount;
        dailySpent[owner][day] += amount;
        balanceOf[owner] -= amount;

        token.safeTransfer(to, amount);
        emit Spent(owner, to, amount, msg.sender, nonce);
    }

    // ─── Views ──────────────────────────────────────────────────────────────

    /// @notice USDC still spendable today under the daily cap (ignores balance).
    function dailyRemaining(address owner) external view returns (uint256) {
        Policy memory p = policyOf[owner];
        uint256 spent = dailySpent[owner][block.timestamp / 1 days];
        return p.dailyCap > spent ? p.dailyCap - spent : 0;
    }

    /// @notice USDC still spendable over the session's lifetime budget.
    function budgetRemaining(address owner) external view returns (uint256) {
        Policy memory p = policyOf[owner];
        return p.totalBudget > totalSpent[owner] ? p.totalBudget - totalSpent[owner] : 0;
    }

    /// @notice EIP-712 domain separator (handy for off-chain signers).
    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }
}
