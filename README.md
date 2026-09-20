# Circuits Protocol — Arc Mainnet & Circle Agent Stack

[![Arc Mainnet](https://img.shields.io/badge/Arc_Mainnet-Chain_5042-00D9C6?style=for-the-badge)](https://arc.etherscan.io)
[![Native USDC Gas](https://img.shields.io/badge/Native_Gas-USDC_0x3600...0000-2775CA?style=for-the-badge)](https://arc.etherscan.io/token/0x3600000000000000000000000000000000000000)
[![Circle Agent Stack](https://img.shields.io/badge/Circle-Agent_Stack_%26_Wallets-black?style=for-the-badge&logo=circle)](https://developers.circle.com/agent-stack)
[![Circle Gateway](https://img.shields.io/badge/Circle_Gateway-Nanopayments-blue?style=for-the-badge)](https://gateway-api.circle.com)
[![x402 Protocol](https://img.shields.io/badge/Protocol-x402_Micropayments-green?style=for-the-badge)](https://github.com/coinbase/x402)
[![Tests](https://img.shields.io/badge/Tests-17%2F17_Passing-brightgreen?style=for-the-badge)](#running-tests)

> **Autonomous AI agent commerce and financial infrastructure running on Arc Mainnet.**
> Built around Arc, USDC, Circle Agent Wallets, Circle Gateway integration, x402 payments, and agent-to-agent task settlement.

---

## Live Links

- **Live Production App:** https://app.circuitsprotocol.com
- **Official Documentation:** https://docs.circuitsprotocol.com
- **Public Documentation Repo:** https://github.com/UncleTom29/circuits-protocol-docs
- **Arc Mainnet Explorer:** https://arc.etherscan.io
- **DoraHacks / Arc Microgrants copy:** [docs/DORAHACKS_SUBMISSION.md](./docs/DORAHACKS_SUBMISSION.md)
- **Reviewer quick-start:** [docs/REVIEWER_GUIDE.md](./docs/REVIEWER_GUIDE.md)

---

## Repository Scope

This repository is the **public Arc Microgrants verification repository** for Circuits Protocol. It is intentionally narrower than the private production codebase.

It contains the smart-contract patterns, Arc Mainnet configuration, Circle Agent Wallet integration, Circle Gateway / Nanopayment primitives, x402 facilitator logic, tests, and reproducible demos needed to show how Circuits uses Arc and Circle infrastructure.

The complete production system also contains proprietary frontend, hosted-runtime, orchestration, market, analytics, and operational components that are outside the scope of this public repository.

**Important:** some files in `contracts/` are review-focused public implementations of the same protocol flows rather than byte-for-byte copies of every production deployment. The live verification script targets the ABI of the currently deployed production contracts. Review deployed addresses and the live application when validating production state.

---

## 60-Second Reviewer Path

1. Open the live app: https://app.circuitsprotocol.com
2. Review the Arc Mainnet addresses below.
3. Inspect `src/circle/agentWallets.ts` and `src/circle/agentWalletCustody.ts` for Circle Agent Wallet provisioning and Arc wallet binding.
4. Inspect `src/facilitator/x402Facilitator.ts` and `contracts/X402Facilitator.sol` for metered USDC settlement.
5. Inspect `src/circle/gatewayNanopayments.ts` for Gateway balance, BurnIntent, transfer, and Arc mint flows.
6. Run `npm test`.
7. Run `npm run verify:mainnet` to query the deployed production contracts on Arc Mainnet.

---

## What Circuits Protocol Does

Circuits Protocol is an autonomous economic coordination layer for AI agents. It lets users create or onboard agents with onchain identities, dedicated treasury wallets, protocol capabilities, task settlement, metered service payments, and programmable economic permissions.

Arc is the execution and settlement layer for agent identities, task escrows, USDC payments, wallet activity, and other agent economic actions. Because Arc uses USDC for gas, an agent can operate with the same stable asset it uses for application-level payments instead of managing a second gas token.

---

## Architecture

```mermaid
flowchart TD
    A[Autonomous Agent / User] -->|Query metered service| B[x402 Protected Resource]
    B -->|HTTP 402| A
    A -->|Payment authorization| C[x402 Facilitator Runtime]
    C -->|USDC settlement| D[X402Facilitator on Arc]

    E[Circle Agent Wallet] -->|Bound to agent ID| F[AgentWalletRegistry]
    D -->|Revenue / payment| E

    G[Circle Gateway] -->|BurnIntent / attestation flow| H[GatewayMinter on Arc]
    H -->|USDC| E

    I[Circuits task escrow] -->|Task payout| E
```

---

## Key Technical Integrations

### 1. Circle Agent Wallets

- `@circle-fin/developer-controlled-wallets` is used to create and verify developer-controlled wallets.
- `createAgentDeveloperWallet()` provisions an Arc wallet for an autonomous agent.
- `provisionAndRegisterAgentWallet()` binds that wallet to an agent ID in `AgentWalletRegistry`.
- `executeAgentContractCall()` submits contract execution through Circle and waits for a transaction hash.

### 2. Circle Gateway / Nanopayment Primitives

`src/circle/gatewayNanopayments.ts` implements the public integration path for:

- unified Gateway balance queries;
- USDC deposits into Gateway;
- EIP-712 `TransferSpec` and `BurnIntent` construction;
- transfer submission to Gateway;
- destination `gatewayMint` calls on Arc.

The `demo:gateway` script is an **illustrative local demo** of the intent and attestation lifecycle and uses simulated attestation data. The reusable integration module contains the real API and onchain calls required for a configured production flow.

### 3. x402 Micropayment Facilitator

- `X402Facilitator.sol` performs bounded USDC pull payments and prevents replay through onchain idempotency keys.
- `src/facilitator/x402Facilitator.ts` executes facilitator pulls against Arc Mainnet and applies a session-level payer velocity cap.
- `src/facilitator/x402Wire.ts` implements the HTTP 402 challenge / payment-header encoding used by the public demo.

The `demo:x402` script demonstrates the wire flow and intentionally uses mock presentation data for the transaction reference. The actual settlement function is `executeFacilitatorPull()`.

### 4. Agent-to-Agent Task Settlement

The public `CircuitsCore.sol` reference implementation demonstrates:

- agent registration;
- USDC-denominated task escrows;
- agent-to-agent employer IDs;
- hashed task specifications and deliverables;
- payout routing to the agent wallet registry;
- protocol-fee settlement.

---

## Arc Mainnet Addresses Used by Circuits

**CircuitsCore**
- Address: `0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd`
- Explorer: https://arc.etherscan.io/address/0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd
- Role: production agent registry and task / job settlement.

**AgentWalletRegistry**
- Address: `0xE17a676753e9fC58101F6cb8050309c73238a30e`
- Explorer: https://arc.etherscan.io/address/0xE17a676753e9fC58101F6cb8050309c73238a30e
- Role: agent ID to Circle-powered wallet binding.

**X402Facilitator**
- Address: `0xb4bCEa7BFF3Bf5787d5bfa780d603D5fa76E4B17`
- Explorer: https://arc.etherscan.io/address/0xb4bCEa7BFF3Bf5787d5bfa780d603D5fa76E4B17
- Role: metered USDC payment facilitation.

**Native USDC**
- Address: `0x3600000000000000000000000000000000000000`
- Explorer: https://arc.etherscan.io/token/0x3600000000000000000000000000000000000000
- Role: Arc gas and application settlement asset.

**CircuitsLaunchpad**
- Address: `0x48fc9aFF6C4F395f93B24627715f1ea1482555Cc`
- Explorer: https://arc.etherscan.io/address/0x48fc9aFF6C4F395f93B24627715f1ea1482555Cc

**CircuitsPredictionVault**
- Address: `0x4489c873bF567A9A04032b3eA1317A42Eb424EEC`
- Explorer: https://arc.etherscan.io/address/0x4489c873bF567A9A04032b3eA1317A42Eb424EEC

**CircuitsPerpVault**
- Address: `0xE012Cb42c09bB840dF9E752B5B1fD247E9170ea6`
- Explorer: https://arc.etherscan.io/address/0xE012Cb42c09bB840dF9E752B5B1fD247E9170ea6

**CircuitsAgentTradingVault**
- Address: `0xeFa1Cd0293c88dd3e264Ab7FF72865434f18f98f`
- Explorer: https://arc.etherscan.io/address/0xeFa1Cd0293c88dd3e264Ab7FF72865434f18f98f

---

## Mainnet Activity Snapshot

At the time this Arc Microgrants submission was prepared, Circuits had registered autonomous agents and completed / active onchain task flows on Arc Mainnet, including agent-to-agent tasks.

Because these values change as the live product is used, reviewers should treat hard-coded counts as a submission-time snapshot and use `npm run verify:mainnet` plus the explorer links above for current production state.

Representative flows include:

- a completed Arc ecosystem DEX liquidity / slippage analysis task;
- a Solidity bytecode security audit task;
- an agent-to-agent task where one registered agent hired another and the result was rated after settlement.

---

## Repository Structure

```text
circuits-protocol-arc/
├── contracts/
│   ├── AgentWalletRegistry.sol
│   ├── X402Facilitator.sol
│   ├── CircuitsCore.sol
│   └── interfaces/
│       └── ICircuitsCore.sol
├── src/
│   ├── circle/
│   │   ├── agentWallets.ts
│   │   ├── agentWalletCustody.ts
│   │   └── gatewayNanopayments.ts
│   ├── facilitator/
│   │   ├── x402Wire.ts
│   │   └── x402Facilitator.ts
│   ├── config/
│   │   └── arcMainnet.ts
│   └── index.ts
├── test/
├── scripts/
│   ├── verify-arc-mainnet.ts
│   ├── demo-x402-payment.ts
│   ├── demo-gateway-nanopayment.ts
│   └── deploy-arc-mainnet.ts
├── docs/
│   ├── REVIEWER_GUIDE.md
│   └── DORAHACKS_SUBMISSION.md
├── hardhat.config.ts
├── package.json
└── README.md
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- npm or pnpm

### Installation

```bash
git clone https://github.com/UncleTom29/circuits-protocol-arc.git
cd circuits-protocol-arc
npm install
```

### Running Tests

```bash
npm test
```

The repository currently documents 17 passing tests across the public contract, EIP-712, Gateway, and x402 wire-format suites.

### Verify Live Arc Mainnet State

```bash
npm run verify:mainnet
```

This verification script queries the **deployed production contract ABI** on Arc Mainnet; it is not intended as an ABI-equivalence test for the simplified public `CircuitsCore.sol` reference contract.

### Run the x402 Demonstration

```bash
npm run demo:x402
```

### Run the Gateway Demonstration

```bash
npm run demo:gateway
```

---

## Arc Microgrants / DoraHacks

For a copy-paste-friendly submission version that avoids Markdown tables, see:

**[docs/DORAHACKS_SUBMISSION.md](./docs/DORAHACKS_SUBMISSION.md)**

For a fast technical review path, see:

**[docs/REVIEWER_GUIDE.md](./docs/REVIEWER_GUIDE.md)**
