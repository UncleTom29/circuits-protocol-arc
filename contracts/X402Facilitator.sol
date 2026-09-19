// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title X402Facilitator
/// @notice Metered per-call micropayment facilitator contract for autonomous AI agents on Arc Mainnet.
/// @dev Enables automated, metered HTTP 402 ("Payment Required") resource delivery for AI agents.
/// Payer agents or user wallets grant this contract a bounded ERC-20 allowance. An authorized facilitator
/// signer pulls payments upon receipt and validation of client requests.
///
/// Double-pull and replay attacks are prevented atomically on-chain: `idempotencyKey` is marked and checked
/// in the same transaction as the transfer. Sub-second block times and deterministic execution on Arc Mainnet
/// provide ultra-fast API turnaround for agent-to-agent (A2A) queries.
contract X402Facilitator is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    address public facilitator;
    bool public paused;

    mapping(bytes32 => bool) public usedIdempotencyKeys;

    event PaymentPulled(
        address indexed payer,
        address indexed recipient,
        uint256 amount,
        bytes32 indexed idempotencyKey
    );
    event FacilitatorUpdated(address indexed previousFacilitator, address indexed newFacilitator);
    event PausedSet(bool paused);

    error NotFacilitator();
    error FacilitatorPaused();
    error IdempotencyKeyAlreadyUsed();
    error ZeroAmount();
    error ZeroAddress();

    modifier onlyFacilitator() {
        if (msg.sender != facilitator) revert NotFacilitator();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert FacilitatorPaused();
        _;
    }

    constructor(address initialOwner, IERC20 usdc_, address initialFacilitator) Ownable(initialOwner) {
        if (initialFacilitator == address(0)) revert ZeroAddress();
        usdc = usdc_;
        facilitator = initialFacilitator;
    }

    /// @notice Pulls `amount` of USDC from `payer` to `recipient` against a prior ERC-20 allowance.
    /// @dev Reverts if `idempotencyKey` was previously used, guaranteeing single execution.
    /// @param payer The address funding the micropayment (who has approved this contract).
    /// @param recipient The agent, provider, or treasury receiving payment.
    /// @param amount Amount of USDC in base units (6 decimals).
    /// @param idempotencyKey Cryptographic hash uniquely identifying this payment authorization.
    function pullPayment(
        address payer,
        address recipient,
        uint256 amount,
        bytes32 idempotencyKey
    ) external onlyFacilitator whenNotPaused nonReentrant {
        if (amount == 0) revert ZeroAmount();
        if (payer == address(0) || recipient == address(0)) revert ZeroAddress();
        if (usedIdempotencyKeys[idempotencyKey]) revert IdempotencyKeyAlreadyUsed();

        usedIdempotencyKeys[idempotencyKey] = true;
        usdc.safeTransferFrom(payer, recipient, amount);

        emit PaymentPulled(payer, recipient, amount, idempotencyKey);
    }

    /// @notice Rotates the authorized facilitator signer address.
    /// @param newFacilitator Address of the new facilitator backend key.
    function setFacilitator(address newFacilitator) external onlyOwner {
        if (newFacilitator == address(0)) revert ZeroAddress();
        emit FacilitatorUpdated(facilitator, newFacilitator);
        facilitator = newFacilitator;
    }

    /// @notice Emergency circuit breaker to halt new micropayment pulls.
    /// @param paused_ True to pause pulls, false to unpause.
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PausedSet(paused_);
    }
}
