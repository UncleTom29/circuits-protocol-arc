# Arc Microgrants Reviewer Guide

This page is the shortest path for verifying the Arc- and Circle-specific parts of Circuits Protocol.

## 1. Open the live application

https://app.circuitsprotocol.com

Circuits is already running on Arc Mainnet.

## 2. Verify Arc Mainnet deployment

Run:

```bash
git clone https://github.com/UncleTom29/circuits-protocol-arc.git
cd circuits-protocol-arc
npm install
npm run verify:mainnet
```

The verification script connects directly to Arc Mainnet and queries the deployed production contracts.

Primary production addresses:

- CircuitsCore: `0xcB30D334c9fb9F7c0e753ef413f5233ACFBC3fAd`
- AgentWalletRegistry: `0xE17a676753e9fC58101F6cb8050309c73238a30e`
- X402Facilitator: `0xb4bCEa7BFF3Bf5787d5bfa780d603D5fa76E4B17`
- Native USDC: `0x3600000000000000000000000000000000000000`

Explorer: https://arc.etherscan.io

## 3. Review Circle Agent Wallet integration

Read:

- `src/circle/agentWallets.ts`
- `src/circle/agentWalletCustody.ts`
- `contracts/AgentWalletRegistry.sol`

What to look for:

- Developer-Controlled Wallet SDK initialization.
- Arc wallet creation.
- Wallet-set management.
- Agent wallet lookup and verification.
- Programmatic Circle contract execution.
- Onchain binding of a wallet to an agent ID.

## 4. Review x402 settlement

Read:

- `src/facilitator/x402Wire.ts`
- `src/facilitator/x402Facilitator.ts`
- `contracts/X402Facilitator.sol`

What to look for:

- HTTP 402 payment requirements.
- X-PAYMENT header handling.
- Arc CAIP network identifier.
- USDC settlement.
- Onchain idempotency / replay prevention.
- Facilitator pause controls.
- Payer velocity limits.

Run:

```bash
npm run demo:x402
```

Note: this command is an illustrative protocol demo and displays mock transaction-reference data. The actual Arc settlement implementation is `executeFacilitatorPull()`.

## 5. Review Circle Gateway integration

Read:

- `src/circle/gatewayNanopayments.ts`
- `scripts/demo-gateway-nanopayment.ts`

What to look for:

- Gateway balance query.
- Gateway USDC deposit.
- EIP-712 TransferSpec.
- EIP-712 BurnIntent.
- Gateway transfer API request.
- Attestation handling.
- `gatewayMint` execution on Arc.

Run:

```bash
npm run demo:gateway
```

Note: the demo command uses simulated attestation material to make the lifecycle easy to inspect locally. The reusable module contains the actual Gateway API and onchain call path.

## 6. Review agent-to-agent commerce

Read:

- `contracts/CircuitsCore.sol`
- `contracts/interfaces/ICircuitsCore.sol`

The public reference contract demonstrates:

- agent registration;
- USDC task escrows;
- agent employer IDs;
- task specification hashes;
- deliverable hashes;
- task confirmation and rating;
- payout routing into the registered agent wallet.

## 7. Run tests

```bash
npm test
```

The repository documents 17 passing tests across the public contract and integration modules.

## 8. Understand repository scope

This repository was created specifically for Arc Microgrants verification and is not the complete private Circuits production monorepo.

It exposes the smart-contract patterns, Arc configuration, Circle Agent Wallet integration, x402 facilitator, Gateway primitives, tests, and demos needed to understand the Arc-native implementation.

Some public contract files are review-focused implementations of the same flows rather than byte-for-byte copies of all production contracts. The mainnet verification script intentionally queries the currently deployed production ABI.

## Recommended review order

1. Live app.
2. Arc explorer addresses.
3. `src/circle/agentWallets.ts`.
4. `src/facilitator/x402Facilitator.ts`.
5. `src/circle/gatewayNanopayments.ts`.
6. `npm test`.
7. `npm run verify:mainnet`.

That sequence should establish whether the project is real, deployed on Arc Mainnet, and meaningfully integrated with Circle infrastructure in only a few minutes.
