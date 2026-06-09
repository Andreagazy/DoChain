const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

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

  const artifact = await hre.artifacts.readArtifact("DocumentHashRegistry");
  const network = hre.network.name;
  const deploymentDir = path.join(__dirname, "..", "deployments", network);
  fs.mkdirSync(deploymentDir, { recursive: true });

  const deployment = {
    contractName: "DocumentHashRegistry",
    address,
    network,
    chainId: Number((await hre.ethers.provider.getNetwork()).chainId),
    deployer: deployer.address,
    abi: artifact.abi,
    deployedAt: new Date().toISOString(),
  };

  fs.writeFileSync(
    path.join(deploymentDir, "DocumentHashRegistry.json"),
    JSON.stringify(deployment, null, 2),
  );

  const backendAbiPath = path.join(
    __dirname,
    "..",
    "..",
    "docfides-backend",
    "src",
    "module",
    "blockchain",
    "abi.json",
  );
  if (fs.existsSync(path.dirname(backendAbiPath))) {
    fs.writeFileSync(backendAbiPath, JSON.stringify(artifact.abi, null, 2));
    console.log("Backend ABI updated at: docfides-backend/src/module/blockchain/abi.json");
  }

  console.log(
    `Deployment metadata saved to: deployments/${network}/DocumentHashRegistry.json`,
  );
  console.log(`Set backend DOCUMENT_REGISTRY_ADDRESS=${address}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
