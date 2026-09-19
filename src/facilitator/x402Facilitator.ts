import {
  createWalletClient,
  createPublicClient,
  http,
  parseAbi,
  parseUnits,
  keccak256,
  toBytes,
  type Address,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { ARC_MAINNET_CONFIG } from "../config/arcMainnet";

const FACILITATOR_ABI = parseAbi([
  "function pullPayment(address payer, address recipient, uint256 amount, bytes32 idempotencyKey) external",
  "function usedIdempotencyKeys(bytes32 key) external view returns (bool)",
  "function paused() external view returns (bool)",
]);

export class PaymentRejection extends Error {}

export interface PullPaymentParams {
  facilitatorContractAddress: Address;
  facilitatorPrivateKey: Hex;
  payerAddress: Address;
  recipientAddress: Address;
  amountUsdc: string;
  idempotencyKey: string;
  rpcUrl?: string;
}

export interface PullPaymentResult {
  txHash: Hex;
  payer: Address;
  recipient: Address;
  amountUsdc: string;
  idempotencyKey: string;
}

// In-memory velocity ledger for the facilitator session (bounds per-payer 24h exposure)
const dailyPayerPulls = new Map<string, number>();
const DAILY_CAP_USDC = 50.0; // 50 USDC daily limit per payer through this facilitator

/**
 * Executes a metered x402 pull payment through X402Facilitator on Arc Mainnet.
 *
 * Arc Mainnet's native USDC gas model guarantees sub-cent, deterministic transaction
 * fees for high-frequency agent-to-agent interactions.
 */
export async function executeFacilitatorPull(
  params: PullPaymentParams,
): Promise<PullPaymentResult> {
  const {
    facilitatorContractAddress,
    facilitatorPrivateKey,
    payerAddress,
    recipientAddress,
    amountUsdc,
    idempotencyKey,
    rpcUrl = ARC_MAINNET_CONFIG.rpcUrl,
  } = params;

  const parsedAmount = Number.parseFloat(amountUsdc);
  if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
    throw new PaymentRejection(`Invalid payment amount: ${amountUsdc}`);
  }

  // Velocity cap check
  const currentDaily = dailyPayerPulls.get(payerAddress.toLowerCase()) || 0;
  if (currentDaily + parsedAmount > DAILY_CAP_USDC) {
    throw new PaymentRejection(
      `Velocity cap exceeded: ${payerAddress} daily pull limit is ${DAILY_CAP_USDC} USDC (attempted: ${currentDaily + parsedAmount})`,
    );
  }

  const account = privateKeyToAccount(facilitatorPrivateKey);
  const chain = ARC_MAINNET_CONFIG.viemChain;
  const transport = http(rpcUrl);
  const publicClient = createPublicClient({ chain, transport });
  const walletClient = createWalletClient({ account, chain, transport });

  const isPaused = await publicClient.readContract({
    address: facilitatorContractAddress,
    abi: FACILITATOR_ABI,
    functionName: "paused",
  });
  if (isPaused) {
    throw new PaymentRejection("X402Facilitator contract is currently paused on Arc Mainnet.");
  }

  const idempotencyKeyBytes32 = keccak256(toBytes(idempotencyKey));
  const isUsed = await publicClient.readContract({
    address: facilitatorContractAddress,
    abi: FACILITATOR_ABI,
    functionName: "usedIdempotencyKeys",
    args: [idempotencyKeyBytes32],
  });
  if (isUsed) {
    throw new PaymentRejection(`Idempotency key ${idempotencyKey} has already been settled on-chain.`);
  }

  const amountRaw = parseUnits(amountUsdc, 6);

  try {
    const txHash = await walletClient.writeContract({
      address: facilitatorContractAddress,
      abi: FACILITATOR_ABI,
      functionName: "pullPayment",
      args: [payerAddress, recipientAddress, amountRaw, idempotencyKeyBytes32],
      account,
      chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    if (receipt.status !== "success") {
      throw new Error("pullPayment transaction reverted on-chain");
    }

    // Update velocity ledger
    dailyPayerPulls.set(payerAddress.toLowerCase(), currentDaily + parsedAmount);

    return {
      txHash,
      payer: payerAddress,
      recipient: recipientAddress,
      amountUsdc,
      idempotencyKey,
    };
  } catch (err) {
    throw new PaymentRejection(
      err instanceof Error ? err.message : `Payment pull failed: ${String(err)}`,
    );
  }
}
