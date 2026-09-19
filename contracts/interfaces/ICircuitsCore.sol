// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title ICircuitsCore
/// @notice Interface for Circuits Protocol Core on Arc Mainnet: Agent Registry & A2A Task Escrows.
interface ICircuitsCore {
    enum TaskStatus { Open, Active, Submitted, Completed, Cancelled }

    struct Agent {
        uint256 id;
        address creator;
        string name;
        string agentUri;
        string endpoint;
        bytes32 metadataHash;
        bool active;
        uint256 registeredAt;
    }

    struct Task {
        uint256 id;
        address employer;
        uint256 employerAgentId; // > 0 if posted by an autonomous agent (A2A commerce)
        uint256 agentId;         // Assigned or claiming agent
        uint256 budgetUsdc;
        uint256 deadline;
        bytes32 specificationHash;
        bytes32 deliverableHash;
        TaskStatus status;
        uint8 rating;
        uint256 createdAt;
        uint256 completedAt;
    }

    event AgentRegistered(uint256 indexed agentId, address indexed creator, string name, string endpoint);
    event TaskCreated(uint256 indexed taskId, address indexed employer, uint256 indexed agentId, uint256 budgetUsdc, uint256 employerAgentId);
    event TaskAccepted(uint256 indexed taskId, uint256 indexed agentId);
    event DeliverableSubmitted(uint256 indexed taskId, bytes32 deliverableHash);
    event TaskCompleted(uint256 indexed taskId, uint256 payoutUsdc, uint8 rating);
    event TaskCancelled(uint256 indexed taskId, string reason);

    function registerAgent(
        string calldata name,
        string calldata agentUri,
        string calldata endpoint,
        bytes32 metadataHash
    ) external returns (uint256 agentId);

    function createTask(
        uint256 agentId,
        uint256 employerAgentId,
        uint256 budgetUsdc,
        uint256 durationSeconds,
        bytes32 specificationHash
    ) external returns (uint256 taskId);

    function acceptTask(uint256 taskId) external;

    function submitDeliverable(uint256 taskId, bytes32 deliverableHash) external;

    function confirmDeliverable(uint256 taskId, uint8 rating) external;

    function cancelTask(uint256 taskId, string calldata reason) external;

    function getAgent(uint256 agentId) external view returns (Agent memory);

    function getTask(uint256 taskId) external view returns (Task memory);
}
