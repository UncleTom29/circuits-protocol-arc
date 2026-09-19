import {
  createPublicClient,
  createWalletClient,
  http,
  pad,
  parseUnits,
  type Address,
  type Chain,
  type Hex,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Circle Gateway & Nanopayments Client
 *
 * Circle Gateway provides a unified USDC balance across multiple chains with sub-500ms
 * attestation-based minting. In Circuits Protocol, autonomous agents leverage Circle Gateway
 * for instant, cross-chain-funded settlement and high-frequency micropayments ("nanopayments").
 *
 * Settlement on Arc Mainnet benefits from sub-second finality and deterministic gas costs
 * paid natively in USDC.
 */

export const GATEWAY_DOMAIN = { name: "GatewayWallet", version: "1" } as const;

export const TRANSFER_SPEC_TYPE = [
  { name: "version", type: "uint32" },
  { name: "sourceDomain", type: "uint32" },
  { name: "destinationDomain", type: "uint32" },
  { name: "sourceContract", type: "bytes32" },
  { name: "destinationContract", type: "bytes32" },
  { name: "sourceToken", type: "bytes32" },
  { name: "destinationToken", type: "bytes32" },
  { name: "sourceDepositor", type: "bytes32" },
  { name: "destinationRecipient", type: "bytes32" },
  { name: "sourceSigner", type: "bytes32" },
  { name: "destinationCaller", type: "bytes32" },
  { name: "value", type: "uint256" },
  { name: "salt", type: "bytes32" },
  { name: "hookData", type: "bytes" },
] as const;

export const BURN_INTENT_TYPE = [
  { name: "maxBlockHeight", type: "uint256" },
  { name: "maxFee", type: "uint256" },
  { name: "spec", type: "TransferSpec" },
] as const;

export const GATEWAY_MINT_ABI = [
  {
    type: "function",
    name: "gatewayMint",
    inputs: [
      { name: "attestationPayload", type: "bytes" },
      { name: "signature", type: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const GATEWAY_WALLET_DEPOSIT_ABI = [
  {
    type: "function",
    name: "deposit",
    inputs: [
      { name: "token", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
] as const;

export const ERC20_APPROVE_ABI = [
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
] as const;

export function addressToBytes32(address: Address): Hex {
  return pad(address, { size: 32 });
}

export interface GatewayEvmChainConfig {
  domain: number;
  chain: Chain;
  rpcUrl: string;
  gatewayWalletAddress: Address;
  gatewayMinterAddress: Address;
  usdcAddress: Address;
}

export interface GatewayBalanceSource {
  domain: number;
  depositor: string;
}

export interface GatewayBalance extends GatewayBalanceSource {
  balance: string;
  pendingBatch: string;
}

/**
 * Queries Circle Gateway POST /v1/balances to inspect unified USDC balance across chains.
 */
export async function getUnifiedBalance(
  apiUrl: string,
  sources: GatewayBalanceSource[],
): Promise<GatewayBalance[]> {
  const response = await fetch(`${apiUrl}/balances`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token: "USDC", sources }),
  });
  if (!response.ok) {
    throw new Error(`Gateway /v1/balances failed: ${response.status} ${await response.text()}`);
  }
  const body = (await response.json()) as { balances: GatewayBalance[] };
  return body.balances;
}

/**
 * Deposits USDC into GatewayWallet contract, funding the agent's unified cross-chain balance.
 */
export async function depositToGateway(
  config: GatewayEvmChainConfig,
  privateKey: Hex,
  amountUsdc: string,
): Promise<{ approveTx: Hex; depositTx: Hex }> {
  const account = privateKeyToAccount(privateKey);
  const walletClient = createWalletClient({
    account,
    chain: config.chain,
    transport: http(config.rpcUrl),
  });
  const value = parseUnits(amountUsdc, 6);

  const approveTx = await walletClient.writeContract({
    address: config.usdcAddress,
    abi: ERC20_APPROVE_ABI,
    functionName: "approve",
    args: [config.gatewayWalletAddress, value],
  });

  const depositTx = await walletClient.writeContract({
    address: config.gatewayWalletAddress,
    abi: GATEWAY_WALLET_DEPOSIT_ABI,
    functionName: "deposit",
    args: [config.usdcAddress, value],
  });

  return { approveTx, depositTx };
}

export interface RequestGatewayTransferInput {
  apiUrl: string;
  source: GatewayEvmChainConfig;
  destination: GatewayEvmChainConfig;
  sourcePrivateKey: Hex;
  recipientAddress: Address;
  amountUsdc: string;
  blockHeightBuffer?: bigint;
  maxFeeUsdc?: bigint;
}

export interface GatewayAttestation {
  attestation: Hex;
  signature: Hex;
}

/**
 * Constructs and signs an EIP-712 BurnIntent, submits it to Circle Gateway, and obtains
 * an instant sub-second attestation payload for minting on Arc Mainnet.
 */
export async function requestGatewayTransfer(
  input: RequestGatewayTransferInput,
): Promise<GatewayAttestation> {
  const {
    apiUrl,
    source,
    destination,
    sourcePrivateKey,
    recipientAddress,
    amountUsdc,
    blockHeightBuffer = 1000n,
    maxFeeUsdc = 10_000n,
  } = input;

  const account = privateKeyToAccount(sourcePrivateKey);
  const publicClient = createPublicClient({ chain: source.chain, transport: http(source.rpcUrl) });
  const currentBlock = await publicClient.getBlockNumber();

  const salt = crypto.getRandomValues(new Uint8Array(32));
  const saltHex = ("0x" + Buffer.from(salt).toString("hex")) as Hex;

  const spec = {
    version: 1,
    sourceDomain: source.domain,
    destinationDomain: destination.domain,
    sourceContract: addressToBytes32(source.gatewayWalletAddress),
    destinationContract: addressToBytes32(destination.gatewayMinterAddress),
    sourceToken: addressToBytes32(source.usdcAddress),
    destinationToken: addressToBytes32(destination.usdcAddress),
    sourceDepositor: addressToBytes32(account.address),
    destinationRecipient: addressToBytes32(recipientAddress),
    sourceSigner: addressToBytes32(account.address),
    destinationCaller: addressToBytes32("0x0000000000000000000000000000000000000000"),
    value: parseUnits(amountUsdc, 6),
    salt: saltHex,
    hookData: "0x" as Hex,
  };

  const burnIntent = {
    maxBlockHeight: currentBlock + blockHeightBuffer,
    maxFee: maxFeeUsdc,
    spec,
  };

  const signature = await account.signTypedData({
    domain: GATEWAY_DOMAIN,
    types: { TransferSpec: [...TRANSFER_SPEC_TYPE], BurnIntent: [...BURN_INTENT_TYPE] },
    primaryType: "BurnIntent",
    message: burnIntent,
  });

  const response = await fetch(`${apiUrl}/transfer`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify([{ burnIntent, signature }], (_key, val) =>
      typeof val === "bigint" ? val.toString() : val,
    ),
  });

  if (!response.ok) {
    throw new Error(`Gateway /v1/transfer failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as GatewayAttestation;
}

/**
 * Submits the Gateway attestation on Arc Mainnet, minting USDC directly to the recipient agent.
 */
export async function mintOnArc(
  destination: GatewayEvmChainConfig,
  minterPrivateKey: Hex,
  attestation: GatewayAttestation,
): Promise<Hex> {
  const account = privateKeyToAccount(minterPrivateKey);
  const walletClient = createWalletClient({
    account,
    chain: destination.chain,
    transport: http(destination.rpcUrl),
  });

  return walletClient.writeContract({
    address: destination.gatewayMinterAddress,
    abi: GATEWAY_MINT_ABI,
    functionName: "gatewayMint",
    args: [attestation.attestation, attestation.signature],
  });
}
