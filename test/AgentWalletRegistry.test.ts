import { expect } from "chai";
import { ethers } from "hardhat";
import type { AgentWalletRegistry } from "../typechain-types";

describe("AgentWalletRegistry (Circle Agent Wallet Identity on Arc)", () => {
  let registry: AgentWalletRegistry;
  let owner: any;
  let registrar: any;
  let unauthorized: any;
  let circleWallet: any;

  beforeEach(async () => {
    [owner, registrar, unauthorized, circleWallet] = await ethers.getSigners();

    const RegistryFactory = await ethers.getContractFactory("AgentWalletRegistry");
    registry = (await RegistryFactory.deploy(owner.address, registrar.address)) as unknown as AgentWalletRegistry;
  });

  it("allows authorized registrar to bind a Circle Developer-Controlled wallet to an agent ID", async () => {
    const agentId = 1;

    const tx = await registry.connect(registrar).setAgentWallet(agentId, circleWallet.address);

    await expect(tx)
      .to.emit(registry, "AgentWalletSet")
      .withArgs(agentId, circleWallet.address);

    expect(await registry.agentWallet(agentId)).to.equal(circleWallet.address);
  });

  it("enforces permanent wallet binding and reverts if attempting to overwrite an existing agent wallet", async () => {
    const agentId = 1;
    await registry.connect(registrar).setAgentWallet(agentId, circleWallet.address);

    const anotherWallet = unauthorized.address;
    await expect(
      registry.connect(registrar).setAgentWallet(agentId, anotherWallet),
    ).to.be.revertedWithCustomError(registry, "WalletAlreadySet");
  });

  it("reverts if a non-registrar account attempts to set an agent wallet", async () => {
    await expect(
      registry.connect(unauthorized).setAgentWallet(2, circleWallet.address),
    ).to.be.revertedWithCustomError(registry, "NotRegistrar");
  });

  it("allows contract owner to rotate the registrar", async () => {
    const newRegistrar = unauthorized;

    await expect(registry.connect(owner).setRegistrar(newRegistrar.address))
      .to.emit(registry, "RegistrarUpdated")
      .withArgs(registrar.address, newRegistrar.address);

    expect(await registry.registrar()).to.equal(newRegistrar.address);

    // New registrar can set wallets
    await expect(registry.connect(newRegistrar).setAgentWallet(5, circleWallet.address))
      .to.emit(registry, "AgentWalletSet")
      .withArgs(5, circleWallet.address);
  });
});
