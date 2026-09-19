import { expect } from "chai";
import { ethers } from "hardhat";
import type { X402Facilitator, MockUSDC } from "../typechain-types";

describe("X402Facilitator (Arc Mainnet Micropayments)", () => {
  let facilitatorContract: X402Facilitator;
  let usdc: MockUSDC;
  let owner: any;
  let facilitatorSigner: any;
  let payer: any;
  let recipient: any;
  let unauthorized: any;

  const USDC_AMOUNT = ethers.parseUnits("0.05", 6); // 5 cents micropayment ($0.05 USDC)

  beforeEach(async () => {
    [owner, facilitatorSigner, payer, recipient, unauthorized] = await ethers.getSigners();

    const MockUSDCFactory = await ethers.getContractFactory("MockUSDC");
    usdc = (await MockUSDCFactory.deploy()) as unknown as MockUSDC;

    const FacilitatorFactory = await ethers.getContractFactory("X402Facilitator");
    facilitatorContract = (await FacilitatorFactory.deploy(
      owner.address,
      await usdc.getAddress(),
      facilitatorSigner.address,
    )) as unknown as X402Facilitator;

    // Fund payer with USDC and approve Facilitator
    await usdc.mint(payer.address, ethers.parseUnits("100", 6));
    await usdc.connect(payer).approve(await facilitatorContract.getAddress(), ethers.parseUnits("50", 6));
  });

  it("successfully pulls payment on-chain with valid authorization and allowance", async () => {
    const idempotencyKey = ethers.keccak256(ethers.toUtf8Bytes("pull-req-001"));
    const recipientBefore = await usdc.balanceOf(recipient.address);

    const tx = await facilitatorContract
      .connect(facilitatorSigner)
      .pullPayment(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey);

    await expect(tx)
      .to.emit(facilitatorContract, "PaymentPulled")
      .withArgs(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey);

    const recipientAfter = await usdc.balanceOf(recipient.address);
    expect(recipientAfter - recipientBefore).to.equal(USDC_AMOUNT);
    expect(await facilitatorContract.usedIdempotencyKeys(idempotencyKey)).to.be.true;
  });

  it("reverts atomically if the same idempotency key is re-used (anti-replay guard)", async () => {
    const idempotencyKey = ethers.keccak256(ethers.toUtf8Bytes("pull-req-duplicate"));

    await facilitatorContract
      .connect(facilitatorSigner)
      .pullPayment(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey);

    await expect(
      facilitatorContract
        .connect(facilitatorSigner)
        .pullPayment(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey),
    ).to.be.revertedWithCustomError(facilitatorContract, "IdempotencyKeyAlreadyUsed");
  });

  it("rejects pull attempts from unauthorized signers", async () => {
    const idempotencyKey = ethers.keccak256(ethers.toUtf8Bytes("pull-req-unauth"));

    await expect(
      facilitatorContract
        .connect(unauthorized)
        .pullPayment(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey),
    ).to.be.revertedWithCustomError(facilitatorContract, "NotFacilitator");
  });

  it("respects the pause kill-switch", async () => {
    const idempotencyKey = ethers.keccak256(ethers.toUtf8Bytes("pull-req-paused"));

    await facilitatorContract.connect(owner).setPaused(true);
    expect(await facilitatorContract.paused()).to.be.true;

    await expect(
      facilitatorContract
        .connect(facilitatorSigner)
        .pullPayment(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey),
    ).to.be.revertedWithCustomError(facilitatorContract, "FacilitatorPaused");

    await facilitatorContract.connect(owner).setPaused(false);
    await expect(
      facilitatorContract
        .connect(facilitatorSigner)
        .pullPayment(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey),
    ).to.emit(facilitatorContract, "PaymentPulled");
  });

  it("allows owner to rotate the authorized facilitator signer", async () => {
    const newSigner = unauthorized;
    await facilitatorContract.connect(owner).setFacilitator(newSigner.address);
    expect(await facilitatorContract.facilitator()).to.equal(newSigner.address);

    const idempotencyKey = ethers.keccak256(ethers.toUtf8Bytes("pull-req-rotated"));
    await expect(
      facilitatorContract
        .connect(newSigner)
        .pullPayment(payer.address, recipient.address, USDC_AMOUNT, idempotencyKey),
    ).to.emit(facilitatorContract, "PaymentPulled");
  });
});
