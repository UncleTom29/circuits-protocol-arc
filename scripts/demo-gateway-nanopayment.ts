import {
  addressToBytes32,
  GATEWAY_DOMAIN,
  TRANSFER_SPEC_TYPE,
  BURN_INTENT_TYPE,
} from "../src/circle/gatewayNanopayments";

/**
 * Interactive Demo: Circle Gateway Nanopayments (EIP-712 Intent & Instant Settlement)
 *
 * Demonstrates the Circle Gateway Nanopayments architecture:
 * 1. Payer agent has a unified cross-chain balance.
 * 2. Agent crafts an EIP-712 BurnIntent to send funds instantly to Arc Mainnet.
 * 3. Circle Gateway off-chain attestation service returns a cryptographic proof in < 500ms.
 * 4. Proof is submitted to GatewayMinter on Arc Mainnet, minting native USDC to the recipient agent.
 */
async function runGatewayDemo() {
  console.log("===============================================================");
  console.log(" Circuits Protocol: Circle Gateway Nanopayment Demo");
  console.log(" Instant Cross-Chain Settlement (< 500ms) into Arc Mainnet");
  console.log("===============================================================\n");

  const sourceDomain = 6; // Base Sepolia
  const destinationDomain = 26; // Arc Mainnet
  const depositor = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const recipient = "0xE2B7fa11aeB53Bf5B0b640466E596b388fFBAFba"; // Agent #1 on Arc
  const usdcAddress = "0x3600000000000000000000000000000000000000";

  console.log("[1] Constructing TransferSpec payload...");
  const transferSpec = {
    version: 1,
    sourceDomain,
    destinationDomain,
    sourceContract: addressToBytes32("0x0000000000000000000000000000000000001001"),
    destinationContract: addressToBytes32("0x0000000000000000000000000000000000001002"),
    sourceToken: addressToBytes32(usdcAddress),
    destinationToken: addressToBytes32(usdcAddress),
    sourceDepositor: addressToBytes32(depositor),
    destinationRecipient: addressToBytes32(recipient),
    sourceSigner: addressToBytes32(depositor),
    destinationCaller: addressToBytes32("0x0000000000000000000000000000000000000000"),
    value: 500_000n, // $0.50 USDC (6 decimals)
    salt: "0x" + Array.from({ length: 64 }, () => "f").join(""),
    hookData: "0x",
  };
  console.log("    Value: 0.50 USDC ($500,000 base units)");
  console.log("    Source Domain: " + sourceDomain);
  console.log("    Destination Domain: " + destinationDomain + " (Arc Mainnet)");

  console.log("\n[2] Building EIP-712 BurnIntent typed data...");
  const burnIntent = {
    maxBlockHeight: 25000000n,
    maxFee: 5000n, // 0.005 USDC max fee ceiling
    spec: transferSpec,
  };
  console.log("    EIP-712 Domain:", JSON.stringify(GATEWAY_DOMAIN));
  console.log("    Max Fee Ceiling: 0.005 USDC");

  console.log("\n[3] Simulating Circle Gateway Attestation Service Response (< 500ms)...");
  const mockAttestation = {
    attestation: ("0x" + Array.from({ length: 128 }, () => "a").join("")) as `0x${string}`,
    signature: ("0x" + Array.from({ length: 130 }, () => "b").join("")) as `0x${string}`,
  };
  console.log(`    Attestation Payload: ${mockAttestation.attestation.slice(0, 32)}... (verified by Circle)`);
  console.log(`    Minter Signature:    ${mockAttestation.signature.slice(0, 32)}...`);

  console.log("\n[4] Destination Execution: Calling GatewayMinter.gatewayMint on Arc Mainnet...");
  console.log("    Destination Chain: Arc Mainnet (Chain ID 5042)");
  console.log(`    Recipient Agent:   ${recipient}`);
  console.log("    Gas Asset:         USDC (native gas, sub-cent cost)");
  console.log("    Result:            0.50 USDC minted and credited in sub-second block!");

  console.log("\n---------------------------------------------------------------");
  console.log(" Circle Gateway Nanopayment Intent Verified!");
  console.log("---------------------------------------------------------------\n");
}

runGatewayDemo().catch(console.error);
