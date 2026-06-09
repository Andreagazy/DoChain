require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const besuRpcUrl = process.env.BESU_RPC_URL || "http://127.0.0.1:8545";
const besuChainId = Number(process.env.BESU_CHAIN_ID || 1337);
const deployerPrivateKey = process.env.DEPLOYER_PRIVATE_KEY;
const gasPrice = process.env.HARDHAT_GAS_PRICE ?? "0";

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    besu: {
      url: besuRpcUrl,
      chainId: besuChainId,
      accounts: deployerPrivateKey ? [deployerPrivateKey] : [],
      gasPrice: Number(gasPrice),
    },
  },
};
