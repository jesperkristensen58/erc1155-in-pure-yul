const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

console.log("🧪 testing...");

describe("ERC1155Yul", function () {
  let erc1155yul;
  let owner;
  let other;

  beforeEach(async function () {
    // load the compiled Yul contract from the build directory
    // (see README on how to compile)
    var abi = require('../build/ERC1155Yul.abi.json');
    var bytecode = require('../build/ERC1155Yul.bytecode.json').object;

    // Contracts are deployed using the first signer/account by default
    [owner, alice] = await ethers.getSigners();

    const ERC1155YulContract = await hre.ethers.getContractFactory(abi, bytecode);
    erc1155yul = await ERC1155YulContract.deploy("https://token-cdn-domain/{id}.json"); // @note the argument is not actually used (hardcoded in the constructor)
    await erc1155yul.deployed();
  })

  describe("Deployment", function () {
    it("Should set the right hardcoded URI on deployment", async function () {
      expect(await erc1155yul.uri(0)).to.equal("https://token-cdn-domain/{id}.json");
      // any other account can access too
      expect(await erc1155yul.connect(alice).uri(0)).to.equal("https://token-cdn-domain/{id}.json");
    });
  });

  describe("Runtime", function () {
    it("Should allow minting", async function () {
      let tx = await erc1155yul.mint(alice.address, 1, 4);
      await tx.wait();

      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(4);
    });
    
    it("Should allow repeated minting", async function () {
      let tx = await erc1155yul.mint(alice.address, 1, 4);
      await tx.wait();
  
      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(4);
  
      tx = await erc1155yul.mint(alice.address, 1, 8);
      await tx.wait();
  
      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(12);
    });
  });
});