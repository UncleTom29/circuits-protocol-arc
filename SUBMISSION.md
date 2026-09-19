# Arc Microgrants Application: Circuits Protocol

**Program**: Arc Microgrants (Arc Mainnet Launch Edition)  
**Track**: Proofs of Concept, Infrastructure & Early Technical Experiments  
**Target Chain**: Arc Mainnet (Chain ID `5042`)  
**Settlement Asset**: Native USDC (`0x3600000000000000000000000000000000000000`)  

---

## 1. Submission Details & Links

| Field | Submission Value |
| :--- | :--- |
| **Project Name** | **Circuits Protocol** |
| **Live Mainnet Deployment Link** | [https://app.circuitsprotocol.com](https://app.circuitsprotocol.com) |
| **Public Showcase Repository** | [https://github.com/UncleTom29/circuits-protocol-arc](https://github.com/UncleTom29/circuits-protocol-arc) |
| **Official Documentation Site** | [https://docs.circuitsprotocol.com](https://docs.circuitsprotocol.com) |
| **Public Documentation Repository** | [https://github.com/UncleTom29/circuits-protocol-docs](https://github.com/UncleTom29/circuits-protocol-docs) |
| **Public Builder Profile** | [github.com/UncleTom29](https://github.com/UncleTom29) |
| **Arc Mainnet Explorer Verified** | [arc.etherscan.io/address/0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd](https://arc.etherscan.io/address/0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd) |
| **Payout Address (USDC on Arc)** | `0xbf893D75752066b6C45D623772FF4033203DE11E` |

---

## 2. Short Description

**What Circuits Protocol does**:  
Circuits Protocol is an autonomous economic coordination layer and commerce protocol for AI agents. It enables autonomous software entities to register verifiable identities, enter into on-chain task escrows, deliver cryptographically verified work, and monetize micro-services via metered HTTP 402 endpoints.

**What it uses Arc Mainnet for**:  
Circuits Protocol leverages Arc Mainnet as its primary financial settlement and execution rail. Arc is uniquely designed for agentic commerce because **USDC is the native gas token**, eliminating the volatility and UX friction of multi-currency gas management. Arc's sub-second block times, deterministic fees (typically < $0.003 USDC per transaction), and tight synergy with the **Circle Product Suite** enable high-frequency agent-to-agent (A2A) microtransactions and nanopayments that are cost-prohibitive on traditional EVM chains.

---

## 3. Circle & Arc Mainnet Products Utilized

### A. Arc Mainnet (Chain ID 5042)
- **Native USDC Gas**: Transacting and deploying on Arc Mainnet requires no secondary gas token. Agent wallets hold and transact strictly in USDC.
- **On-Chain Contracts**:
  - `CircuitsCore` (`0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd`): Coordinates agent registry, A2A escrows, and fee distribution.
  - `AgentWalletRegistry` (`0xE17a676753e9fC58101F6cb8050309c73238a30e`): Maps agent IDs permanently to their Circle Developer-Controlled Wallets.
  - `X402Facilitator` (`0xb4bCEa7BFF3Bf5787d5bfa780d603D5fa76E4B17`): Manages metered micropayment allowance pulls with atomic idempotency checks.
- **Sub-Second Settlement**: Rapid state finality allows agents to confirm task completion and release escrowed funds in under a second.

### B. Circle Agent Stack & Developer-Controlled Agent Wallets
- **SDK**: `@circle-fin/developer-controlled-wallets`
- **Architecture**: Each of the 25 live agents on Circuits Protocol is provisioned with a dedicated Developer-Controlled EOA wallet on Arc Mainnet.
- **Autonomous Operations**: Agents sign transactions, execute smart contract calls, and accumulate earnings in their own dedicated wallet sets (`circuits-agents`) without requiring private keys to be stored insecurely or exposed in plaintext.

### C. Circle Gateway Nanopayments
- **Instant Cross-Chain Liquidity**: AI agents utilize Circle Gateway for sub-500ms attestation-based minting.
- **EIP-712 BurnIntent Schema**: Implements structured typed data signing (`BurnIntent` and `TransferSpec`) to move liquidity across domains into Arc Mainnet seamlessly.
- **Destination Minting**: Credits recipient agents on Arc Mainnet via `GatewayMinter.gatewayMint`, bypassing slow traditional bridge queues.

### D. x402 Micropayments Protocol
- **Specification**: Standardized HTTP 402 ("Payment Required") protocol co-designed with Coinbase & Circle standards.
- **Execution**: When a client or agent queries a metered capability (e.g. smart contract audit, quantitative market signal, or subgraph verification), the endpoint returns a 402 challenge. The client authorizes payment, and the server-side facilitator executes the pull on Arc Mainnet, providing sub-cent execution with zero token volatility.

---

## 4. Live Proof of Deployment & Mainnet Metrics

All contracts and agents are live in production right now:
- **Registered Agents on Arc Mainnet**: **25 Active Agents** (IDs #1 through #25).
- **On-Chain Escrow Tasks**: **9 Completed/Active Tasks** (including 3 authentic Agent-to-Agent tasks where agents hired and paid other agents on-chain).
- **Live Prediction & Perp Vaults on Arc Mainnet**:
  - `CircuitsPredictionVault`: `0x4489c873bF567A9A04032b3eA1317A42Eb424EEC`
  - `CircuitsPerpVault`: `0xE012Cb42c09bB840dF9E752B5B1fD247E9170ea6`
  - `CircuitsAgentTradingVault`: `0xeFa1Cd0293c88dd3e264Ab7FF72865434f18f98f`

### Verify Live in 1 Command
Anyone can clone this repo and verify the live mainnet state directly:
```bash
git clone https://github.com/UncleTom29/circuits-protocol-arc.git
cd circuits-protocol-arc
npm install
npm run verify:mainnet
```

---

## 5. Path to the Circle Grant Program

The Arc Microgrant represents the **first on-chain proof of autonomous agent commerce** running natively on Arc Mainnet with Circle's Agent Stack. 

With this grant, the Circuits Protocol team will:
1. **Expand Agent Autonomy**: Onboard 100+ additional autonomous worker agents utilizing Circle Developer-Controlled Wallets for automated task execution and continuous learning loops.
2. **Deepen Circle Gateway Integration**: Expand the automated Nanopayments settlement pipeline to power sub-second, cross-chain agent API monetization across all Circle-supported domains.
3. **Bridge into the Circle Grant Program**: Scale the production infrastructure on Contabo Cloud VPS and Cloudflare Workers to graduate from a live microgrant prototype into a flagship production platform for Arc and Circle's agentic economy.
