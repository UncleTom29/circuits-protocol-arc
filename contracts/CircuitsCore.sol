// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {ICircuitsCore} from "./interfaces/ICircuitsCore.sol";
import {AgentWalletRegistry} from "./AgentWalletRegistry.sol";

/// @title CircuitsCore
/// @notice Core Protocol Contract on Arc Mainnet: AI Agent Registry & Agent-to-Agent (A2A) Task Escrows.
/// @dev Deployed on Arc Mainnet at 0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd.
/// Handles autonomous agent lifecycle, task escrow locks, deliverable proofs, and settlement routing.
/// When an escrow task completes, payouts are routed directly to the agent's Circle Developer-Controlled
/// Wallet registered in {AgentWalletRegistry}, enabling fully autonomous agent balance accumulation and spend.
contract CircuitsCore is ICircuitsCore, Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdc;
    AgentWalletRegistry public immutable agentWalletRegistry;
    address public treasury;

    uint256 public registrationFee; // 5 USDC ($5,000,000 in 6 decimals) on Arc Mainnet
    uint256 public constant PROTOCOL_FEE_BPS = 100; // 1.0% protocol escrow completion fee
    uint256 public constant BPS_DIVISOR = 10_000;

    uint256 public agentCount;
    uint256 public taskCount;

    mapping(uint256 => Agent) public agents;
    mapping(uint256 => Task) public tasks;
    mapping(address => bool) public isFeeExempt;

    error InvalidParameters();
    error AgentNotFound();
    error TaskNotFound();
    error TaskNotOpen();
    error TaskNotActive();
    error TaskNotSubmitted();
    error Unauthorized();
    error InsufficientBudget();
    error ZeroAddress();

    constructor(
        address initialOwner,
        IERC20 usdc_,
        address treasury_,
        AgentWalletRegistry registry_
    ) Ownable(initialOwner) {
        if (address(usdc_) == address(0) || treasury_ == address(0) || address(registry_) == address(0)) {
            revert ZeroAddress();
        }
        usdc = usdc_;
        treasury = treasury_;
        agentWalletRegistry = registry_;
        registrationFee = 5_000_000; // 5 USDC default on Arc Mainnet
    }

    /// @notice Registers an autonomous AI agent on Arc Mainnet.
    /// @param name The public handle or identifier of the agent.
    /// @param agentUri IPFS or HTTPS URI pointing to the agent's capabilities manifest.
    /// @param endpoint Live execution endpoint for agent-to-agent RPC queries.
    /// @param metadataHash SHA-256 hash of agent configuration / weights / system prompt.
    function registerAgent(
        string calldata name,
        string calldata agentUri,
        string calldata endpoint,
        bytes32 metadataHash
    ) external nonReentrant returns (uint256 agentId) {
        if (bytes(name).length == 0 || bytes(endpoint).length == 0) revert InvalidParameters();

        if (registrationFee > 0 && !isFeeExempt[msg.sender]) {
            usdc.safeTransferFrom(msg.sender, treasury, registrationFee);
        }

        unchecked {
            agentId = ++agentCount;
        }

        agents[agentId] = Agent({
            id: agentId,
            creator: msg.sender,
            name: name,
            agentUri: agentUri,
            endpoint: endpoint,
            metadataHash: metadataHash,
            active: true,
            registeredAt: block.timestamp
        });

        emit AgentRegistered(agentId, msg.sender, name, endpoint);
    }

    /// @notice Creates an on-chain task escrow in USDC on Arc Mainnet.
    /// @dev If `employerAgentId > 0`, records this as an Agent-to-Agent (A2A) task.
    /// @param agentId The specific agent hired (or 0 for an open bounty claimable by any active agent).
    /// @param employerAgentId ID of the employer agent (or 0 if hired by a direct human client).
    /// @param budgetUsdc Escrow budget locked in USDC base units (6 decimals).
    /// @param durationSeconds Allowed duration for completion.
    /// @param specificationHash SHA-256 hash of task requirements & acceptance criteria.
    function createTask(
        uint256 agentId,
        uint256 employerAgentId,
        uint256 budgetUsdc,
        uint256 durationSeconds,
        bytes32 specificationHash
    ) external nonReentrant returns (uint256 taskId) {
        if (budgetUsdc == 0 || durationSeconds == 0 || specificationHash == bytes32(0)) revert InvalidParameters();
        if (agentId > 0 && (agentId > agentCount || !agents[agentId].active)) revert AgentNotFound();
        if (employerAgentId > 0 && (employerAgentId > agentCount || !agents[employerAgentId].active)) revert AgentNotFound();

        usdc.safeTransferFrom(msg.sender, address(this), budgetUsdc);

        unchecked {
            taskId = ++taskCount;
        }

        TaskStatus initialStatus = (agentId > 0) ? TaskStatus.Active : TaskStatus.Open;

        tasks[taskId] = Task({
            id: taskId,
            employer: msg.sender,
            employerAgentId: employerAgentId,
            agentId: agentId,
            budgetUsdc: budgetUsdc,
            deadline: block.timestamp + durationSeconds,
            specificationHash: specificationHash,
            deliverableHash: bytes32(0),
            status: initialStatus,
            rating: 0,
            createdAt: block.timestamp,
            completedAt: 0
        });

        emit TaskCreated(taskId, msg.sender, agentId, budgetUsdc, employerAgentId);
    }

    /// @notice Claims an open bounty task.
    function acceptTask(uint256 taskId) external nonReentrant {
        Task storage task = tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Open) revert TaskNotOpen();
        if (block.timestamp > task.deadline) revert TaskNotOpen();

        task.status = TaskStatus.Active;
        emit TaskAccepted(taskId, task.agentId);
    }

    /// @notice Submits cryptographic deliverable proof for an active task.
    /// @dev Called by assigned agent or agent's Circle Developer-Controlled Wallet.
    function submitDeliverable(uint256 taskId, bytes32 deliverableHash) external nonReentrant {
        Task storage task = tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Active) revert TaskNotActive();
        if (deliverableHash == bytes32(0)) revert InvalidParameters();

        address registeredWallet = agentWalletRegistry.agentWallet(task.agentId);
        address creator = agents[task.agentId].creator;

        if (msg.sender != creator && msg.sender != registeredWallet && task.agentId != 0) {
            revert Unauthorized();
        }

        task.deliverableHash = deliverableHash;
        task.status = TaskStatus.Submitted;

        emit DeliverableSubmitted(taskId, deliverableHash);
    }

    /// @notice Confirms task completion, rates the agent, and disburses funds to the agent's Circle wallet.
    /// @param taskId The task ID to settle.
    /// @param rating 1-5 star performance rating.
    function confirmDeliverable(uint256 taskId, uint8 rating) external nonReentrant {
        Task storage task = tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status != TaskStatus.Submitted) revert TaskNotSubmitted();
        if (msg.sender != task.employer && msg.sender != owner()) revert Unauthorized();
        if (rating < 1 || rating > 5) revert InvalidParameters();

        task.status = TaskStatus.Completed;
        task.rating = rating;
        task.completedAt = block.timestamp;

        // Determine destination wallet: Circle Developer-Controlled Wallet if registered, otherwise creator
        address payoutRecipient = agentWalletRegistry.agentWallet(task.agentId);
        if (payoutRecipient == address(0)) {
            payoutRecipient = agents[task.agentId].creator;
        }

        uint256 fee = 0;
        if (!isFeeExempt[task.employer] && !isFeeExempt[payoutRecipient]) {
            fee = (task.budgetUsdc * PROTOCOL_FEE_BPS) / BPS_DIVISOR;
        }
        uint256 payout = task.budgetUsdc - fee;

        if (fee > 0) {
            usdc.safeTransfer(treasury, fee);
        }
        usdc.safeTransfer(payoutRecipient, payout);

        emit TaskCompleted(taskId, payout, rating);
    }

    /// @notice Cancels an unaccepted or expired task and refunds the employer.
    function cancelTask(uint256 taskId, string calldata reason) external nonReentrant {
        Task storage task = tasks[taskId];
        if (task.id == 0) revert TaskNotFound();
        if (task.status == TaskStatus.Completed || task.status == TaskStatus.Cancelled) revert InvalidParameters();
        if (msg.sender != task.employer && msg.sender != owner()) revert Unauthorized();

        task.status = TaskStatus.Cancelled;
        usdc.safeTransfer(task.employer, task.budgetUsdc);

        emit TaskCancelled(taskId, reason);
    }

    /// @notice Sets registration fee for new agents.
    function setRegistrationFee(uint256 newFee) external onlyOwner {
        registrationFee = newFee;
    }

    /// @notice Whitelists an address for fee exemption.
    function setFeeExempt(address account, bool exempt) external onlyOwner {
        isFeeExempt[account] = exempt;
    }

    /// @notice Batch whitelists addresses for fee exemption.
    function setFeeExemptBatch(address[] calldata accounts, bool exempt) external onlyOwner {
        for (uint256 i = 0; i < accounts.length; i++) {
            isFeeExempt[accounts[i]] = exempt;
        }
    }

    /// @notice Updates treasury address.
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasury = newTreasury;
    }

    function getAgent(uint256 agentId) external view override returns (Agent memory) {
        return agents[agentId];
    }

    function getTask(uint256 taskId) external view override returns (Task memory) {
        return tasks[taskId];
    }
}
