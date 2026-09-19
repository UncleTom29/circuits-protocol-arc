import { randomUUID } from "node:crypto";
import {
  Blockchain,
  type CircleDeveloperControlledWalletsClient,
  initiateDeveloperControlledWalletsClient,
} from "@circle-fin/developer-controlled-wallets";

export { Blockchain, type CircleDeveloperControlledWalletsClient };

/**
 * Circle Agent Wallets (https://developers.circle.com/agent-stack/agent-wallets)
 * Developer-Controlled Wallets used as autonomous execution accounts for AI agents on Arc Mainnet.
 *
 * Arc Mainnet uses USDC as its native gas currency, allowing agents to hold and spend
 * USDC directly for contract execution, x402 micropayments, and cross-agent commerce.
 */
export const AGENT_WALLET_BLOCKCHAINS = {
  ARC_MAINNET: Blockchain.Arc,
  ARC_TESTNET: Blockchain.ArcTestnet,
  BASE_SEPOLIA: Blockchain.BaseSepolia,
  ETH_SEPOLIA: Blockchain.EthSepolia,
} as const;

export type AgentWalletBlockchainKey = keyof typeof AGENT_WALLET_BLOCKCHAINS;

export class CircleAgentWalletError extends Error {}

export interface DeveloperWallet {
  id: string;
  address: string;
  blockchain: string;
  walletSetId: string;
  state: string;
}

export interface CreateCircleClientParams {
  apiKey: string;
  entitySecret: string;
}

/**
 * Initializes the Circle Developer-Controlled Wallets client.
 */
export function createCircleClient(params: CreateCircleClientParams): CircleDeveloperControlledWalletsClient {
  return initiateDeveloperControlledWalletsClient({
    apiKey: params.apiKey,
    entitySecret: params.entitySecret,
  });
}

/**
 * Validates that a pre-existing wallet is developer-controlled and hosted on Arc Mainnet or supported network.
 */
export async function getVerifiedDeveloperWallet(
  client: CircleDeveloperControlledWalletsClient,
  walletId: string,
): Promise<DeveloperWallet> {
  let response;
  try {
    response = await client.getWallet({ id: walletId });
  } catch (err) {
    throw new CircleAgentWalletError(
      `Circle API rejected wallet lookup (${err instanceof Error ? err.message : String(err)})`,
    );
  }

  const wallet = response.data?.wallet;
  if (!wallet) throw new CircleAgentWalletError("Circle returned no wallet for that id.");
  if (wallet.custodyType !== "DEVELOPER") {
    throw new CircleAgentWalletError(
      "Wallet is User-Controlled (PIN-gated). Autonomous agents require Developer-Controlled wallets.",
    );
  }

  const supported = (Object.values(AGENT_WALLET_BLOCKCHAINS) as string[]).includes(wallet.blockchain);
  if (!supported) {
    throw new CircleAgentWalletError(
      `Wallet is on ${wallet.blockchain}, which is not in supported agent blockchains: ${Object.keys(AGENT_WALLET_BLOCKCHAINS).join(", ")}.`,
    );
  }

  return {
    id: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
    walletSetId: wallet.walletSetId,
    state: wallet.state,
  };
}

export interface ContractExecutionParams {
  walletId: string;
  contractAddress: string;
  callData: `0x${string}`;
  amount?: string;
}

/**
 * Submits an autonomous contract execution transaction intent on Arc Mainnet through Circle.
 * Waits for transaction broadcast and returns the verified txHash.
 */
export async function executeAgentContractCall(
  client: CircleDeveloperControlledWalletsClient,
  params: ContractExecutionParams,
): Promise<{ txHash: string }> {
  const created = await client.createContractExecutionTransaction({
    idempotencyKey: randomUUID(),
    walletId: params.walletId,
    contractAddress: params.contractAddress,
    callData: params.callData,
    amount: params.amount,
    fee: { type: "level", config: { feeLevel: "MEDIUM" } },
  });

  const transactionId = created.data?.id;
  if (!transactionId) {
    throw new CircleAgentWalletError("Circle: contract execution did not return a transaction ID.");
  }

  try {
    const result = await client.getTransaction({ id: transactionId, waitForTxHash: true });
    const txHash = result.data?.transaction?.txHash;
    if (!txHash) throw new Error("Transaction hash was empty.");
    return { txHash };
  } catch (err) {
    throw new CircleAgentWalletError(
      err instanceof Error ? err.message : `Circle transaction ${transactionId} failed to broadcast`,
    );
  }
}

export interface CreateAgentDeveloperWalletParams {
  agentRefId: string;
  name?: string;
  walletSetId?: string;
  blockchain?: Blockchain;
}

/**
 * Resolves or creates a dedicated wallet set for autonomous agents (`circuits-agents`).
 */
export async function getOrCreateAgentWalletSetId(
  client: CircleDeveloperControlledWalletsClient,
  preferredName = "circuits-agents",
): Promise<string> {
  if (process.env.CIRCLE_WALLET_SET_ID) {
    return process.env.CIRCLE_WALLET_SET_ID;
  }

  try {
    const listRes = await client.listWalletSets();
    const sets = (listRes.data?.walletSets ?? []) as Array<{ id: string; name?: string }>;
    const existing = sets.find(
      (s) => s.name?.toLowerCase() === preferredName.toLowerCase(),
    );
    if (existing?.id) return existing.id;
    if (sets.length > 0 && sets[0].id) return sets[0].id;
  } catch {
    // If listing fails or is empty, proceed to create
  }

  const response = await client.createWalletSet({ name: preferredName });
  const walletSetId = response.data?.walletSet?.id;
  if (!walletSetId) {
    throw new CircleAgentWalletError("Circle: failed to create or resolve wallet set ID.");
  }
  return walletSetId;
}

/**
 * Creates a developer-controlled EOA wallet on Arc Mainnet for an autonomous AI agent.
 */
export async function createAgentDeveloperWallet(
  client: CircleDeveloperControlledWalletsClient,
  params: CreateAgentDeveloperWalletParams,
): Promise<{ walletId: string; address: string; walletSetId: string }> {
  const walletSetId = params.walletSetId || (await getOrCreateAgentWalletSetId(client));
  const blockchain = params.blockchain || Blockchain.Arc;
  const name = (params.name || `agent:${params.agentRefId}`).slice(0, 32);

  const response = await client.createWallets({
    walletSetId,
    blockchains: [blockchain],
    count: 1,
    accountType: "EOA",
    metadata: [{ refId: params.agentRefId, name }],
  });

  const wallet = response.data?.wallets?.[0];
  if (!wallet?.id || !wallet.address) {
    throw new CircleAgentWalletError("Circle: failed to create developer wallet.");
  }

  return { walletId: wallet.id, address: wallet.address, walletSetId };
}
