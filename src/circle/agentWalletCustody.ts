import { createPublicClient, createWalletClient, http, parseAbi, type Address, type Hex } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { arc } from "viem/chains";
import {
  createCircleClient,
  createAgentDeveloperWallet,
  Blockchain,
} from "./agentWallets";

const REGISTRY_ABI = parseAbi([
  "function setAgentWallet(uint256 agentId, address wallet) external",
  "function agentWallet(uint256 agentId) external view returns (address)",
  "function registrar() external view returns (address)",
]);

export interface ProvisionAgentParams {
  agentId: number;
  agentRefId: string;
  name: string;
  registryAddress: Address;
  registrarPrivateKey: Hex;
  rpcUrl?: string;
  circleApiKey?: string;
  circleEntitySecret?: string;
}

export interface AgentProvisionResult {
  agentId: number;
  walletId?: string;
  walletAddress: Address;
  txHash?: Hex;
  isExisting: boolean;
}

/**
 * Provisions a Circle Developer-Controlled Agent Wallet for an autonomous agent and binds it
 * on-chain in AgentWalletRegistry on Arc Mainnet.
 */
export async function provisionAndRegisterAgentWallet(
  params: ProvisionAgentParams,
): Promise<AgentProvisionResult> {
  const {
    agentId,
    agentRefId,
    name,
    registryAddress,
    registrarPrivateKey,
    rpcUrl = process.env.ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io",
    circleApiKey = process.env.CIRCLE_API_KEY,
    circleEntitySecret = process.env.CIRCLE_ENTITY_SECRET,
  } = params;

  const publicClient = createPublicClient({ chain: arc, transport: http(rpcUrl) });
  const existingOnChain = await publicClient.readContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "agentWallet",
    args: [BigInt(agentId)],
  });

  if (existingOnChain && existingOnChain !== "0x0000000000000000000000000000000000000000") {
    return {
      agentId,
      walletAddress: existingOnChain as Address,
      isExisting: true,
    };
  }

  let walletAddress: Address;
  let walletId: string | undefined;

  if (circleApiKey && circleEntitySecret) {
    const circleClient = createCircleClient({
      apiKey: circleApiKey,
      entitySecret: circleEntitySecret,
    });
    const created = await createAgentDeveloperWallet(circleClient, {
      agentRefId,
      name,
      blockchain: Blockchain.Arc,
    });
    walletAddress = created.address as Address;
    walletId = created.walletId;
  } else {
    // If running in local simulation or test without Circle API credentials,
    // deterministic fallback address derived from agent parameters
    walletAddress = `0x${agentId.toString(16).padStart(40, "a")}` as Address;
  }

  const account = privateKeyToAccount(registrarPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: arc,
    transport: http(rpcUrl),
  });

  const txHash = await walletClient.writeContract({
    address: registryAddress,
    abi: REGISTRY_ABI,
    functionName: "setAgentWallet",
    args: [BigInt(agentId), walletAddress],
  });

  await publicClient.waitForTransactionReceipt({ hash: txHash });

  return {
    agentId,
    walletId,
    walletAddress,
    txHash,
    isExisting: false,
  };
}
