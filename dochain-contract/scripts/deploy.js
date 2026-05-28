const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  if (!deployer) {
    throw new Error("DEPLOYER_PRIVATE_KEY belum dikonfigurasi di .env");
  }

  console.log(`Deploying DocumentHashRegistry with: ${deployer.address}`);

  const DocumentHashRegistry = await hre.ethers.getContractFactory(
    "DocumentHashRegistry",
  );
  const registry = await DocumentHashRegistry.deploy();
  await registry.waitForDeployment();

  const address = await registry.getAddress();
  console.log(`DocumentHashRegistry deployed to: ${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

