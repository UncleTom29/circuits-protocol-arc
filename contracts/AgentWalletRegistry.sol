// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentWalletRegistry
/// @notice Maps each autonomous agent to its canonical Circle Developer-Controlled / Agent Wallet on Arc Mainnet.
/// @dev Deployed on Arc Mainnet at 0xE17a676753e9fC58101F6cb8050309c73238a30e.
/// Maintained as a dedicated satellite contract to decouple agent identity lifecycle from core execution logic.
/// CircuitsCore reads {agentWallet}'s getter directly at settlement and payout time (e.g. A2A task payouts,
/// bonding curve allocations, and micropayment revenue).
contract AgentWalletRegistry is Ownable {
    address public registrar;
    mapping(uint256 => address) public agentWallet;

    event RegistrarUpdated(address indexed previousRegistrar, address indexed newRegistrar);
    event AgentWalletSet(uint256 indexed agentId, address indexed wallet);

    error NotRegistrar();
    error ZeroAddress();
    error WalletAlreadySet();

    modifier onlyRegistrar() {
        if (msg.sender != registrar) revert NotRegistrar();
        _;
    }

    constructor(address initialOwner, address initialRegistrar) Ownable(initialOwner) {
        if (initialRegistrar == address(0)) revert ZeroAddress();
        registrar = initialRegistrar;
    }

    /// @notice Binds `agentId` to its provisioned Circle Developer-Controlled / Agent Wallet.
    /// @dev One-time-settable: permanent identity binding for the agent. Reverts if already bound.
    /// Called by the authorized registrar shortly after agent registration or during wallet provisioning.
    /// @param agentId The unique ID of the registered autonomous agent.
    /// @param wallet The Circle Developer-Controlled EOA wallet address provisioned for this agent.
    function setAgentWallet(uint256 agentId, address wallet) external onlyRegistrar {
        if (wallet == address(0)) revert ZeroAddress();
        if (agentWallet[agentId] != address(0)) revert WalletAlreadySet();
        agentWallet[agentId] = wallet;
        emit AgentWalletSet(agentId, wallet);
    }

    /// @notice Rotates the authorized registrar address.
    /// @param newRegistrar The new registrar signer address.
    function setRegistrar(address newRegistrar) external onlyOwner {
        if (newRegistrar == address(0)) revert ZeroAddress();
        emit RegistrarUpdated(registrar, newRegistrar);
        registrar = newRegistrar;
    }
}
