import { ethers } from "hardhat";

/**
 * Hardhat Deployment Script for Arc Mainnet (Chain ID 5042)
 *
 * Arc Mainnet uses USDC as native gas currency. Ensure the deployer account has
 * native USDC on Arc Mainnet prior to execution (~0.05 USDC is sufficient for multiple deployments).
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  const balance = await ethers.provider.getBalance(deployerAddress);

  console.log("===============================================================");
  console.log(" Circuits Protocol: Arc Mainnet Deployment");
  console.log("===============================================================");
  console.log(`Deployer Address: ${deployerAddress}`);
  console.log(`Deployer Native Balance: ${ethers.formatUnits(balance, 18)} USDC\n`);

  // Arc Mainnet Native USDC ERC-20 address
  const ARC_USDC_ADDRESS =
    process.env.ARC_MAINNET_USDC_ADDRESS || "0x3600000000000000000000000000000000000000";

  // 1. Deploy AgentWalletRegistry
  console.log("[1] Deploying AgentWalletRegistry...");
  const RegistryFactory = await ethers.getContractFactory("AgentWalletRegistry");
  const registry = await RegistryFactory.deploy(deployerAddress, deployerAddress);
  await registry.waitForDeployment();
  const registryAddress = await registry.getAddress();
  console.log(`    AgentWalletRegistry deployed at: ${registryAddress}`);

  // 2. Deploy X402Facilitator
  console.log("\n[2] Deploying X402Facilitator...");
  const FacilitatorFactory = await ethers.getContractFactory("X402Facilitator");
  const facilitator = await FacilitatorFactory.deploy(
    deployerAddress,
    ARC_USDC_ADDRESS,
    deployerAddress, // Set initial facilitator signer to deployer
  );
  await facilitator.waitForDeployment();
  const facilitatorAddress = await facilitator.getAddress();
  console.log(`    X402Facilitator deployed at: ${facilitatorAddress}`);

  // 3. Deploy CircuitsCore
  console.log("\n[3] Deploying CircuitsCore...");
  const CoreFactory = await ethers.getContractFactory("CircuitsCore");
  const core = await CoreFactory.deploy(
    deployerAddress,
    ARC_USDC_ADDRESS,
    deployerAddress, // Treasury
    registryAddress,
  );
  await core.waitForDeployment();
  const coreAddress = await core.getAddress();
  console.log(`    CircuitsCore deployed at: ${coreAddress}`);

  console.log("\n===============================================================");
  console.log(" Deployment Summary:");
  console.log("---------------------------------------------------------------");
  console.log(`AgentWalletRegistry: ${registryAddress}`);
  console.log(`X402Facilitator:      ${facilitatorAddress}`);
  console.log(`CircuitsCore:         ${coreAddress}`);
  console.log("===============================================================\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
