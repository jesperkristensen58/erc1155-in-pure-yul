/// @title Deploys the ERC1155 Yul Contract
/// @author Jesper Kristensen
const hre = require("hardhat");
const path = require("path")

async function main() {
  
  var abi = require('../build/ERC1155Yul.abi.json');
  var bytecode = require('../build/ERC1155Yul.bytecode.json').object;

  const ERC1155YulContract = await hre.ethers.getContractFactory(abi, bytecode);
  const erc1155yul = await ERC1155YulContract.deploy("https://token-cdn-domain/{id}.json");
  await erc1155yul.deployed();

  console.log(
    `🚢 done. ERC1155 Yul Contract deployed to ${erc1155yul.address}!`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});