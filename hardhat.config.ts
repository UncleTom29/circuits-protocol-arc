import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "@openzeppelin/hardhat-upgrades";
import "@nomicfoundation/hardhat-chai-matchers";
import * as dotenv from "dotenv";

dotenv.config();

const DEPLOYER_PRIVATE_KEY =
  process.env.EVM_DEPLOYER_PRIVATE_KEY ||
  "0x0000000000000000000000000000000000000000000000000000000000000001";

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: "0.8.24",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    hardhat: {},
    // Arc Mainnet - Circle's stablecoin-native Layer 1 blockchain
    // Native gas token: USDC (18 decimals native, 6 decimals ERC-20 at 0x3600...0000)
    // Chain ID: 5042
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC_URL || "https://rpc.mainnet.arc.io",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 5042,
    },
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC_URL || "https://rpc.testnet.arc.network",
      accounts: [DEPLOYER_PRIVATE_KEY],
      chainId: 5042002,
    },
  },
  etherscan: {
    apiKey: {
      arcMainnet: process.env.ETHERSCAN_API_KEY || "",
    },
    customChains: [
      {
        network: "arcMainnet",
        chainId: 5042,
        urls: {
          apiURL: "https://api.etherscan.io/v2/api",
          browserURL: "https://arc.etherscan.io",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

export default config;
