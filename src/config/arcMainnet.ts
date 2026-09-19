import { arc, type Chain } from "viem/chains";
import type { Address } from "viem";

/**
 * Arc Mainnet Canonical Configuration
 *
 * Arc is Circle's stablecoin-native Layer 1 blockchain, launched on mainnet in September 2026.
 * USDC serves as the network's native gas currency, eliminating volatile gas tokens and
 * providing deterministic, sub-cent transaction costs ideal for autonomous AI agent operations.
 */
export const ARC_MAINNET_CONFIG = {
  chainId: 5042,
  chainName: "Arc Mainnet",
  shortName: "Arc",
  rpcUrl: process.env.ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io",
  explorerUrl: "https://arc.etherscan.io",
  nativeCurrency: {
    name: "USD Coin",
    symbol: "USDC",
    decimals: 18, // Arc native view
  },
  // Canonical native USDC ERC-20 interface (6 decimals)
  usdcAddress: (process.env.ARC_MAINNET_USDC_ADDRESS ||
    "0x3600000000000000000000000000000000000000") as Address,

  // Canonical Deployed Contracts on Arc Mainnet
  contracts: {
    circuitsCore: (process.env.ARC_MAINNET_CORE_ADDRESS ||
      "0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd") as Address,
    agentWalletRegistry: (process.env.ARC_MAINNET_AGENT_WALLET_REGISTRY_ADDRESS ||
      "0xE17a676753e9fC58101F6cb8050309c73238a30e") as Address,
    x402Facilitator: (process.env.ARC_MAINNET_FACILITATOR_ADDRESS ||
      "0xb4bCEa7BFF3Bf5787d5bfa780d603D5fa76E4B17") as Address,
    launchpad: "0x48fc9aFF6C4F395f93B24627715f1ea1482555Cc" as Address,
    predictionVault: "0x4489c873bF567A9A04032b3eA1317A42Eb424EEC" as Address,
    perpVault: "0xE012Cb42c09bB840dF9E752B5B1fD247E9170ea6" as Address,
    agentTradingVault: "0xeFa1Cd0293c88dd3e264Ab7FF72865434f18f98f" as Address,
  },

  cctpDomain: 26,
  circleBlockchain: "ARC",
  deploymentBlock: 21154100,

  viemChain: {
    ...arc,
    id: 5042,
    name: "Arc Mainnet",
    nativeCurrency: {
      name: "USD Coin",
      symbol: "USDC",
      decimals: 18,
    },
    rpcUrls: {
      default: { http: ["https://rpc.mainnet.arc.io"] },
      public: { http: ["https://rpc.mainnet.arc.io"] },
    },
    blockExplorers: {
      default: {
        name: "Etherscan",
        url: "https://arc.etherscan.io",
      },
    },
  } as Chain,
} as const;
