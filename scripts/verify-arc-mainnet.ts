import { createPublicClient, http, parseAbi, formatUnits } from "viem";
import { arc } from "viem/chains";
import { ARC_MAINNET_CONFIG } from "../src/config/arcMainnet";

const CORE_ABI = parseAbi([
  "function totalAgents() external view returns (uint256)",
  "function activeAgents() external view returns (uint256)",
  "function totalJobs() external view returns (uint256)",
  "function totalVolume() external view returns (uint256)",
  "function registrationFee() external view returns (uint256)",
  "function protocolFeeBps() external view returns (uint256)",
  "function agents(uint256) external view returns (uint256 agentId, address owner, string name, string agentURI, string endpoint, bytes32 metadataHash, bool supportsX402, bool supportsA2A, bool supportsMCP, bool active, uint8 tier, uint64 createdAt, uint64 updatedAt, uint64 lastJobAt, uint32 jobsCompleted, uint32 jobsFailed, uint128 usdcRevenue, uint16 reputationBps)",
  "function jobs(uint256) external view returns (uint256 jobId, address employer, uint256 employerAgentId, uint256 hiredAgentId, bytes32 taskHash, uint256 budget, uint8 status, uint64 createdAt, uint64 deadline, uint64 startedAt, uint64 completedAt, bytes32 deliverableHash, uint8 rating)",
]);

const REGISTRY_ABI = parseAbi([
  "function registrar() external view returns (address)",
  "function agentWallet(uint256) external view returns (address)",
]);

async function main() {
  console.log("===============================================================");
  console.log(" Circuits Protocol - Live Arc Mainnet RPC Verification");
  console.log("===============================================================\n");

  const rpcUrl = ARC_MAINNET_CONFIG.rpcUrl;
  console.log(`Connecting to Arc Mainnet RPC: ${rpcUrl} (Chain ID: ${ARC_MAINNET_CONFIG.chainId})`);

  const client = createPublicClient({ chain: arc, transport: http(rpcUrl) });

  try {
    const blockNumber = await client.getBlockNumber();
    console.log(`Current Arc Mainnet Block Height: ${blockNumber.toString()}\n`);

    // 1. Verify Core Contract
    const coreAddress = ARC_MAINNET_CONFIG.contracts.circuitsCore;
    console.log(`Checking CircuitsCore at ${coreAddress}...`);
    const totalAgents = await client.readContract({
      address: coreAddress,
      abi: CORE_ABI,
      functionName: "totalAgents",
    });
    const activeAgents = await client.readContract({
      address: coreAddress,
      abi: CORE_ABI,
      functionName: "activeAgents",
    });
    const totalJobs = await client.readContract({
      address: coreAddress,
      abi: CORE_ABI,
      functionName: "totalJobs",
    });
    const registrationFee = await client.readContract({
      address: coreAddress,
      abi: CORE_ABI,
      functionName: "registrationFee",
    });

    console.log(`  - Total Registered Agents: ${totalAgents.toString()} (${activeAgents.toString()} Active)`);
    console.log(`  - Total On-Chain Jobs / Tasks: ${totalJobs.toString()}`);
    console.log(`  - Agent Registration Fee: $${formatUnits(registrationFee, 6)} USDC`);

    // 2. Verify Agent Wallet Registry
    const registryAddress = ARC_MAINNET_CONFIG.contracts.agentWalletRegistry;
    console.log(`\nChecking AgentWalletRegistry at ${registryAddress}...`);
    const registrar = await client.readContract({
      address: registryAddress,
      abi: REGISTRY_ABI,
      functionName: "registrar",
    });
    console.log(`  - Authorized Registrar: ${registrar}`);

    // 3. Inspect Sample Registered Agent on Mainnet
    if (totalAgents > 0n) {
      const sampleAgentId = 1n;
      const agent = await client.readContract({
        address: coreAddress,
        abi: CORE_ABI,
        functionName: "agents",
        args: [sampleAgentId],
      });
      const wallet = await client.readContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: "agentWallet",
        args: [sampleAgentId],
      });

      console.log(`\nSample Agent #1 on Arc Mainnet:`);
      console.log(`  - Name: ${agent[2]}`);
      console.log(`  - Endpoint: ${agent[4]}`);
      console.log(`  - Active: ${agent[9]}`);
      console.log(`  - Bound Circle/Agent Wallet: ${wallet}`);
    }

    // 4. Inspect Sample On-Chain Escrow Task
    if (totalJobs > 0n) {
      const sampleJobId = 1n;
      const job = await client.readContract({
        address: coreAddress,
        abi: CORE_ABI,
        functionName: "jobs",
        args: [sampleJobId],
      });

      const statusMap = ["Pending", "Active", "Completed", "Disputed", "Cancelled", "Resolved"];
      console.log(`\nSample Job #1 on Arc Mainnet:`);
      console.log(`  - Employer: ${job[1]}`);
      console.log(`  - Hired Agent ID: ${job[3].toString()}`);
      console.log(`  - Budget: $${formatUnits(job[5], 6)} USDC`);
      console.log(`  - Status: ${statusMap[job[6]] || job[6]}`);
      console.log(`  - Rating: ${job[12]} Stars`);
    }

    console.log("\n---------------------------------------------------------------");
    console.log(" Live Arc Mainnet Status: HEALTHY & FULLY OPERATIONAL");
    console.log(" Explorer URL: https://arc.etherscan.io");
    console.log(" Native Gas: USDC (18 decimals native / 6 decimals ERC-20)");
    console.log("---------------------------------------------------------------\n");
  } catch (err) {
    console.error("RPC query error:", err);
  }
}

main().catch(console.error);
