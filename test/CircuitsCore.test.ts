import { expect } from "chai";
import { ethers } from "hardhat";
import type { CircuitsCore, AgentWalletRegistry, TestERC20 } from "../typechain-types";

describe("CircuitsCore (Agent Registry & A2A Escrows on Arc Mainnet)", () => {
  let core: CircuitsCore;
  let registry: AgentWalletRegistry;
  let usdc: TestERC20;
  let owner: any;
  let treasury: any;
  let registrar: any;
  let agentCreator: any;
  let agentCircleWallet: any;
  let clientEmployer: any;

  const TASK_BUDGET = ethers.parseUnits("1.0", 6); // $1.00 USDC

  beforeEach(async () => {
    [owner, treasury, registrar, agentCreator, agentCircleWallet, clientEmployer] =
      await ethers.getSigners();

    const TestERC20Factory = await ethers.getContractFactory("TestERC20");
    usdc = (await TestERC20Factory.deploy()) as unknown as TestERC20;

    const RegistryFactory = await ethers.getContractFactory("AgentWalletRegistry");
    registry = (await RegistryFactory.deploy(owner.address, registrar.address)) as unknown as AgentWalletRegistry;

    const CoreFactory = await ethers.getContractFactory("CircuitsCore");
    core = (await CoreFactory.deploy(
      owner.address,
      await usdc.getAddress(),
      treasury.address,
      await registry.getAddress(),
    )) as unknown as CircuitsCore;

    // Set fee exemptions for agent registration in tests
    await core.connect(owner).setFeeExempt(agentCreator.address, true);

    // Fund client with USDC and approve CircuitsCore
    await usdc.mint(clientEmployer.address, ethers.parseUnits("50", 6));
    await usdc.connect(clientEmployer).approve(await core.getAddress(), ethers.parseUnits("50", 6));
  });

  it("registers an autonomous AI agent with capabilities endpoint and metadata", async () => {
    const metadataHash = ethers.sha256(ethers.toUtf8Bytes("arc-research-weights-v1"));

    const tx = await core
      .connect(agentCreator)
      .registerAgent(
        "arc-research",
        "ipfs://QmArcResearchAgent001",
        "https://app.circuitsprotocol.com/agents/arc-research",
        metadataHash,
      );

    await expect(tx)
      .to.emit(core, "AgentRegistered")
      .withArgs(1, agentCreator.address, "arc-research", "https://app.circuitsprotocol.com/agents/arc-research");

    const agent = await core.getAgent(1);
    expect(agent.name).to.equal("arc-research");
    expect(agent.active).to.be.true;
    expect(agent.creator).to.equal(agentCreator.address);
  });

  it("creates an A2A task escrow and completes payout directly to the agent's Circle Developer-Controlled Wallet", async () => {
    // 1. Register agent #1
    const metaHash = ethers.sha256(ethers.toUtf8Bytes("agent-weights"));
    await core.connect(agentCreator).registerAgent(
      "arc-research",
      "ipfs://QmArcResearch",
      "https://app.circuitsprotocol.com/agents/arc-research",
      metaHash,
    );

    // 2. Bind agent #1 to its provisioned Circle Developer-Controlled wallet
    await registry.connect(registrar).setAgentWallet(1, agentCircleWallet.address);
    expect(await registry.agentWallet(1)).to.equal(agentCircleWallet.address);

    // 3. Create task escrow assigned to agent #1
    const specHash = ethers.sha256(ethers.toUtf8Bytes("Spec: Run Arc DEX Liquidity Simulation"));
    const duration = 86400; // 24 hours

    const createTx = await core
      .connect(clientEmployer)
      .createTask(1, 0, TASK_BUDGET, duration, specHash);

    await expect(createTx)
      .to.emit(core, "TaskCreated")
      .withArgs(1, clientEmployer.address, 1, TASK_BUDGET, 0);

    // 4. Submit deliverable from the agent's Circle Developer-Controlled wallet
    const deliverableHash = ethers.sha256(ethers.toUtf8Bytes("Deliverable: Jupyter Notebook + Gas Benchmark"));
    await expect(core.connect(agentCircleWallet).submitDeliverable(1, deliverableHash))
      .to.emit(core, "DeliverableSubmitted")
      .withArgs(1, deliverableHash);

    // 5. Client confirms deliverable (5 stars)
    const walletBalanceBefore = await usdc.balanceOf(agentCircleWallet.address);
    const treasuryBalanceBefore = await usdc.balanceOf(treasury.address);

    const confirmTx = await core.connect(clientEmployer).confirmDeliverable(1, 5);

    // Protocol fee is 1% (100 bps)
    const expectedFee = (TASK_BUDGET * 100n) / 10000n; // $0.01 USDC
    const expectedPayout = TASK_BUDGET - expectedFee;  // $0.99 USDC

    await expect(confirmTx)
      .to.emit(core, "TaskCompleted")
      .withArgs(1, expectedPayout, 5);

    const walletBalanceAfter = await usdc.balanceOf(agentCircleWallet.address);
    const treasuryBalanceAfter = await usdc.balanceOf(treasury.address);

    // Verify funds arrived in the agent's Circle wallet (not creator's personal address)
    expect(walletBalanceAfter - walletBalanceBefore).to.equal(expectedPayout);
    expect(treasuryBalanceAfter - treasuryBalanceBefore).to.equal(expectedFee);

    const task = await core.getTask(1);
    expect(task.status).to.equal(3); // TaskStatus.Completed
    expect(task.rating).to.equal(5);
  });

  it("allows employer to cancel an open task and refund locked USDC escrow", async () => {
    const specHash = ethers.sha256(ethers.toUtf8Bytes("Open Bounty Spec"));
    await core.connect(clientEmployer).createTask(0, 0, TASK_BUDGET, 3600, specHash);

    const balanceBefore = await usdc.balanceOf(clientEmployer.address);
    await core.connect(clientEmployer).cancelTask(1, "Cancelled by client");
    const balanceAfter = await usdc.balanceOf(clientEmployer.address);

    expect(balanceAfter - balanceBefore).to.equal(TASK_BUDGET);

    const task = await core.getTask(1);
    expect(task.status).to.equal(4); // TaskStatus.Cancelled
  });
});
