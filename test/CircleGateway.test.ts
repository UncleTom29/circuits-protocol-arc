import { expect } from "chai";
import {
  addressToBytes32,
  GATEWAY_DOMAIN,
  TRANSFER_SPEC_TYPE,
  BURN_INTENT_TYPE,
} from "../src/circle/gatewayNanopayments";

describe("Circle Gateway Nanopayments (EIP-712 Schema & Types)", () => {
  it("formats EVM addresses to 32-byte zero-padded hex strings", () => {
    const address = "0x3600000000000000000000000000000000000000";
    const bytes32 = addressToBytes32(address);

    expect(bytes32.length).to.equal(66); // 0x + 64 hex characters
    expect(bytes32.startsWith("0x0000000000000000000000003600000000000000000000000000000000000000")).to.be.true;
  });

  it("exports valid EIP-712 domain and type definitions matching Circle specification", () => {
    expect(GATEWAY_DOMAIN.name).to.equal("GatewayWallet");
    expect(GATEWAY_DOMAIN.version).to.equal("1");

    expect(TRANSFER_SPEC_TYPE.length).to.equal(14);
    const fieldNames = TRANSFER_SPEC_TYPE.map((f) => f.name);
    expect(fieldNames).to.include("version");
    expect(fieldNames).to.include("sourceDomain");
    expect(fieldNames).to.include("destinationDomain");
    expect(fieldNames).to.include("value");
    expect(fieldNames).to.include("salt");

    expect(BURN_INTENT_TYPE.length).to.equal(3);
    const burnFields = BURN_INTENT_TYPE.map((f) => f.name);
    expect(burnFields).to.deep.equal(["maxBlockHeight", "maxFee", "spec"]);
  });
});
