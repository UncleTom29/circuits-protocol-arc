import { expect } from "chai";
import {
  build402ChallengeResponse,
  encodePaymentHeader,
  decodePaymentHeader,
  parseX402Body,
  X402_VERSION,
} from "../src/facilitator/x402Wire";

describe("x402 Protocol Wire Format (HTTP 402 AI Agent Micropayments)", () => {
  it("builds a canonical 402 challenge response for Arc Mainnet", () => {
    const challenge = build402ChallengeResponse({
      resource: "/api/agents/arc-research/deep-inference",
      payTo: "0x1111111111111111111111111111111111111111",
      amountUsdc: "0.20",
      description: "Arc Mainnet Quantitative Signal Query",
    });

    expect(challenge.x402Version).to.equal(X402_VERSION);
    expect(challenge.accepts.length).to.equal(1);

    const requirement = challenge.accepts[0];
    expect(requirement.scheme).to.equal("exact");
    expect(requirement.network).to.equal("eip155:5042"); // Arc Mainnet
    expect(requirement.maxAmountRequired).to.equal("0.20");
    expect(requirement.payTo).to.equal("0x1111111111111111111111111111111111111111");
  });

  it("encodes and decodes the base64 X-PAYMENT header with 100% round-trip fidelity", () => {
    const requirement = {
      scheme: "exact",
      network: "eip155:5042",
      maxAmountRequired: "0.08",
      resource: "/api/agents/arc-agentops/risk-scan",
      payTo: "0x2222222222222222222222222222222222222222",
      asset: "0x3600000000000000000000000000000000000000",
    };

    const pull = {
      chain: "ARC_MAINNET",
      payer: "0x3333333333333333333333333333333333333333",
      recipient: "0x2222222222222222222222222222222222222222",
      amount: "0.08",
      idempotencyKey: "pull-arc-test-01",
      txHashOrRef: "0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890",
    };

    const encoded = encodePaymentHeader(requirement, pull);
    expect(typeof encoded).to.equal("string");

    const decoded = decodePaymentHeader(encoded);
    expect(decoded).to.not.be.null;
    expect(decoded?.x402Version).to.equal(X402_VERSION);
    expect(decoded?.scheme).to.equal("exact");
    expect(decoded?.network).to.equal("eip155:5042");
    expect(decoded?.payload.idempotencyKey).to.equal("pull-arc-test-01");
    expect(decoded?.payload.txHashOrRef).to.equal(pull.txHashOrRef);
  });

  it("parses valid 402 response bodies and returns null for invalid payloads", () => {
    const validBody = {
      x402Version: 1,
      accepts: [
        {
          scheme: "exact",
          network: "eip155:5042",
          maxAmountRequired: "0.10",
          resource: "/test",
          payTo: "0x123",
          asset: "0xUSDC",
        },
      ],
    };

    const parsed = parseX402Body(validBody);
    expect(parsed).to.not.be.null;
    expect(parsed?.length).to.equal(1);

    expect(parseX402Body({ invalid: true })).to.be.null;
    expect(parseX402Body(null)).to.be.null;
  });
});
