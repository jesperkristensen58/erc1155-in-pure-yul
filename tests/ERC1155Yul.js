const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
const { expect } = require("chai");

console.log("🧪 testing...");

describe("For the ERC1155 Pure Yul Contract", function () {
  let erc1155yul;
  let owner;
  let other;

  beforeEach(async function () {
    // load the compiled Yul contract from the build directory
    // (see README on how to compile)
    var abi = require('../build/ERC1155Yul.abi.json');
    var bytecode = require('../build/ERC1155Yul.bytecode.json').object;

    // Contracts are deployed using the first signer/account by default
    [owner, alice, bob] = await ethers.getSigners();

    const ERC1155YulContract = await hre.ethers.getContractFactory(abi, bytecode);
    erc1155yul = await ERC1155YulContract.deploy("https://token-cdn-domain/{id}.json"); // @note the argument is not actually used (hardcoded in the constructor)
    await erc1155yul.deployed();
  })

  describe("The deployment", function () {
    it("Should set the right hardcoded URI during construction", async function () {
      expect(await erc1155yul.uri(0)).to.equal("https://token-cdn-domain/{id}.json");
      // any other account can access too
      expect(await erc1155yul.connect(alice).uri(0)).to.equal("https://token-cdn-domain/{id}.json");
    });
  });

  describe("The deployed code", function () {
    it("Should allow minting and getting balanceOf", async function () {
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

    it("Should allow getting balanceOf", async function () {
      let tx = await erc1155yul.mint(alice.address, 1, 4);
      await tx.wait();

      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(4);
      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      
      // try multiple Ids
      tx = await erc1155yul.mint(bob.address, 2, 2);
      await tx.wait();

      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(4);
      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(2);
    });


    it("Should allow getting balanceOfBatch", async function () {
      let tx = await erc1155yul.mint(alice.address, 1, 6);
      await tx.wait();

      tx = await erc1155yul.mint(bob.address, 2, 2);
      await tx.wait();

      // check that balance was correctly set
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(6);
      expect(await erc1155yul.balanceOfBatch([alice.address], [1])).to.deep.equal([6]);

      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOfBatch([bob.address], [1])).to.deep.equal([0]);

      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(2);
      expect(await erc1155yul.balanceOfBatch([bob.address], [2])).to.deep.equal([2]);

      // send in multiple addresses
      expect(await erc1155yul.balanceOfBatch([alice.address, bob.address], [1, 2])).to.deep.equal([6, 2]);

      tx = await erc1155yul.mint(alice.address, 4, 21);
      await tx.wait();

      expect(await erc1155yul.balanceOfBatch([alice.address, bob.address, alice.address], [1, 2, 4])).to.deep.equal([6, 2, 21]);

      // order shouldn't matter
      expect(await erc1155yul.balanceOfBatch([bob.address, alice.address, alice.address], [2, 4, 1])).to.deep.equal([2, 21, 6]);
    });

  it("Should allow mintBatching", async () => {
    let tx = await erc1155yul.mintBatch(alice.address, [21], [41]);
    await tx.wait();

    expect(await erc1155yul.balanceOf(alice.address, 21)).to.equal(41);

    // mint with multiple entries
    tx = await erc1155yul.mintBatch(alice.address, [21, 2, 1], [1, 4, 2]);
    await tx.wait();

    expect(await erc1155yul.balanceOf(alice.address, 21)).to.equal(42);
    expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(4);
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);

    // check balanceOfBatch too
    expect(await erc1155yul.balanceOfBatch([alice.address, alice.address, alice.address], [21, 2, 1])).to.deep.equal([42, 4, 2]);
  });

  it("Should allow for burning tokens", async () => {
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
    expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
    
    tx = await erc1155yul.mint(bob.address, 1, 2);
    await tx.wait();
    // check that balance was correctly set
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
    expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(2);
    
    // now burn
    tx = await erc1155yul.burn(bob.address, 1, 2);
    await tx.wait();

    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
    expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);

    // burn not to zero
    tx = await erc1155yul.mint(bob.address, 1, 2);
    await tx.wait();
    // check that balance was correctly set
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
    expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(2);
    
    // now burn
    tx = await erc1155yul.burn(bob.address, 1, 1);
    await tx.wait();

    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
    expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);

    // burn more than we have
    tx = await erc1155yul.mint(bob.address, 1, 2);
    await tx.wait();
    // check that balance was correctly set
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
    expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(3);
    
    await expect(erc1155yul.burn(bob.address, 1, 4)).to.be.reverted;

    // make sure nothing changed
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
    expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(3);
  });

  it("Should allow for burn batching", async () => {
    // simple single-account
    let tx = await erc1155yul.mintBatch(alice.address, [21], [41]);
    await tx.wait();
    expect(await erc1155yul.balanceOf(alice.address, 21)).to.equal(41);
    tx = await erc1155yul.burnBatch(alice.address, [21], [4]);
    await tx.wait();
    expect(await erc1155yul.balanceOf(alice.address, 21)).to.equal(37);

    // bigger example, more accounts
    tx = await erc1155yul.mintBatch(alice.address, [1, 2, 3], [10, 20, 30]);
    await tx.wait();

    tx = await erc1155yul.mintBatch(bob.address, [5, 6, 7], [51, 62, 73]);
    await tx.wait();
    
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(10);
    expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(20);
    expect(await erc1155yul.balanceOf(alice.address, 3)).to.equal(30);

    expect(await erc1155yul.balanceOf(bob.address, 5)).to.equal(51);
    expect(await erc1155yul.balanceOf(bob.address, 6)).to.equal(62);
    expect(await erc1155yul.balanceOf(bob.address, 7)).to.equal(73);

    tx = await erc1155yul.burnBatch(alice.address, [21, 1, 2, 3], [1, 1, 1, 1]);
    await tx.wait();
    expect(await erc1155yul.balanceOf(alice.address, 21)).to.equal(36);
    expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(9);
    expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(19);
    expect(await erc1155yul.balanceOf(alice.address, 3)).to.equal(29);

    tx = await erc1155yul.burnBatch(bob.address, [5, 6, 7], [1, 2, 12]);
    await tx.wait();
    expect(await erc1155yul.balanceOf(bob.address, 5)).to.equal(50);
    expect(await erc1155yul.balanceOf(bob.address, 6)).to.equal(60);
    expect(await erc1155yul.balanceOf(bob.address, 7)).to.equal(61);
  });

  }); // end of deployed code tests
});