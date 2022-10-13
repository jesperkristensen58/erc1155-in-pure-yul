/*
 * Test the Yul-implemented ERC1155 Contract.
 *
 * @author Jesper Kristensen
 * @date October, 2022
 */
const { expect } = require("chai");

console.log("🧪 testing...");

describe("For the ERC1155 Pure Yul Contract", function () {
  let erc1155yul;
  let owner;
  
  beforeEach(async function () {
    // Contracts are deployed using the first signer/account by default
    [owner, alice, bob] = await ethers.getSigners();

    // ======= DEPLOY ERC1155 Yul-based Contract =================
    // load the compiled Yul contract from the build directory
    // (see README on how to compile)
    var abi = require('../build/ERC1155Yul.abi.json');
    var bytecode = require('../build/ERC1155Yul.bytecode.json').object;
    
    const ERC1155YulContract = await hre.ethers.getContractFactory(abi, bytecode);
    erc1155yul = await ERC1155YulContract.deploy("https://token-cdn-domain/{id}.json"); // @note the argument is not actually used (hardcoded in the constructor)
    await erc1155yul.deployed();

    // ======= DEPLOY NORECEIVER CONTRACT =================
    // deploy the test contract with and without the ERC1155 receiver
    abi = require('../build/NoReceiver.abi.json');
    bytecode = require('../build/NoReceiver.bytecode.json').object;

    const NoReceiverContract = await hre.ethers.getContractFactory(abi, bytecode);
    noreceiver = await NoReceiverContract.deploy();
    await noreceiver.deployed();

    // ======= DEPLOY RECEIVER CONTRACT =================
    // deploy the test contract with and without the ERC1155 receiver
    abi = require('../build/Receiver.abi.json');
    bytecode = require('../build/Receiver.bytecode.json').object;

    const ReceiverContract = await hre.ethers.getContractFactory(abi, bytecode);
    receiver = await ReceiverContract.deploy();
    await receiver.deployed();
  })

  describe("The deployment", function () {

    it("Should deploy to a valid address", async function () {
      await expect(erc1155yul.address).is.properAddress;
      await expect(noreceiver.address).is.properAddress;

      await expect(erc1155yul.address).is.not.null;
      await expect(noreceiver.address).is.not.null;
    });

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

    it("Should respect owner==caller checks", async function () {
      await expect(erc1155yul.connect(alice).mint(alice.address, 1, 4)).to.be.reverted;
      await expect(erc1155yul.connect(alice).mint(bob.address, 1, 4)).to.be.reverted;
      await expect(erc1155yul.connect(bob).burn(alice.address, 1, 4)).to.be.reverted;
      await expect(erc1155yul.connect(bob).burn(bob.address, 1, 4)).to.be.reverted;
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

    it("Should set Approval for all correctly", async () => {

      expect(await erc1155yul.isApprovedForAll(owner.address, alice.address)).to.equal(false);
      expect(await erc1155yul.isApprovedForAll(owner.address, bob.address)).to.equal(false);

      let tx = await erc1155yul.setApprovalForAll(alice.address, true);
      await tx.wait();

      expect(await erc1155yul.isApprovedForAll(owner.address, alice.address)).to.equal(true);
      expect(await erc1155yul.isApprovedForAll(owner.address, bob.address)).to.equal(false);

      tx = await erc1155yul.setApprovalForAll(bob.address, true);
      await tx.wait();

      expect(await erc1155yul.isApprovedForAll(owner.address, alice.address)).to.equal(true);
      expect(await erc1155yul.isApprovedForAll(owner.address, bob.address)).to.equal(true);

      // anyone can check the approval flag
      expect(await erc1155yul.connect(alice).isApprovedForAll(owner.address, alice.address)).to.equal(true);
      expect(await erc1155yul.connect(alice).isApprovedForAll(owner.address, bob.address)).to.equal(true);

      expect(await erc1155yul.connect(bob).isApprovedForAll(owner.address, alice.address)).to.equal(true);
      expect(await erc1155yul.connect(bob).isApprovedForAll(owner.address, bob.address)).to.equal(true);
    });

    it("Should revert on approver == operator", async () => {
      await expect(erc1155yul.connect(alice).setApprovalForAll(alice.address, true)).to.be.reverted;
      await expect(erc1155yul.connect(bob).setApprovalForAll(bob.address, true)).to.be.reverted;
    });

    it("Should allow anyone to set their own approval", async () => {
      expect(await erc1155yul.isApprovedForAll(owner.address, bob.address)).to.equal(false);
      expect(await erc1155yul.isApprovedForAll(alice.address, bob.address)).to.equal(false);

      let tx = await erc1155yul.connect(alice).setApprovalForAll(bob.address, true);
      await tx.wait();

      expect(await erc1155yul.isApprovedForAll(owner.address, bob.address)).to.equal(false);
      expect(await erc1155yul.isApprovedForAll(alice.address, bob.address)).to.equal(true);
    });

    it("Should transfer tokens between accounts", async () => {
      
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      tx = await erc1155yul.mint(alice.address, 1, 2);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      // alice approves the contract owner to move her tokens
      tx = await erc1155yul.connect(alice).setApprovalForAll(owner.address, true);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      expect(await erc1155yul.isApprovedForAll(alice.address, owner.address)).to.equal(true); // owner can operate on alice's tokens

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      tx = await erc1155yul.connect(owner).safeTransferFrom(alice.address, bob.address, 1, 2);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);
    });

    it("Should have the right safeguard in place for transferring", async () => {
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      // alice gets 2 token 1's
      tx = await erc1155yul.mint(alice.address, 1, 2);
      await tx.wait();

      // bob gers 20 token 8's
      tx = await erc1155yul.mint(bob.address, 8, 20);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(bob.address, 8)).to.equal(20);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      // make approvals
      tx = await erc1155yul.connect(alice).setApprovalForAll(owner.address, true);
      await tx.wait();
      tx = await erc1155yul.connect(bob).setApprovalForAll(owner.address, true);
      await tx.wait();
      expect(await erc1155yul.isApprovedForAll(alice.address, owner.address)).to.equal(true); // owner can operate on alice's tokens
      expect(await erc1155yul.isApprovedForAll(bob.address, owner.address)).to.equal(true); // owner can operate on bob's tokens

      expect(await erc1155yul.isApprovedForAll(alice.address, bob.address)).to.equal(false); // owner can operate on bob's tokens
      expect(await erc1155yul.isApprovedForAll(bob.address, alice.address)).to.equal(false); // owner can operate on bob's tokens

      // transfer 1 token from alice to bob
      tx = await erc1155yul.connect(owner).safeTransferFrom(alice.address, bob.address, 1, 1);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 8)).to.equal(20);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      // transfer 2 token 8's from bob to alice
      tx = await erc1155yul.connect(owner).safeTransferFrom(bob.address, alice.address, 8, 2);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(alice.address, 8)).to.equal(2);
      //
      expect(await erc1155yul.balanceOf(bob.address, 8)).to.equal(18);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      //
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 8)).to.equal(0);

      // now try without approval
      await expect(erc1155yul.connect(alice).safeTransferFrom(bob.address, owner.address, 8, 2)).to.be.reverted;
      await expect(erc1155yul.connect(alice).safeTransferFrom(owner.address, bob.address, 8, 2)).to.be.reverted;
      await expect(erc1155yul.connect(bob).safeTransferFrom(alice.address, owner.address, 8, 2)).to.be.reverted;
      await expect(erc1155yul.connect(bob).safeTransferFrom(owner.address, alice.address, 8, 2)).to.be.reverted;

      // change approval
      tx = await erc1155yul.connect(alice).setApprovalForAll(owner.address, false); // owner cannot access alice's funds anymore
      await tx.wait();
      expect(await erc1155yul.isApprovedForAll(alice.address, owner.address)).to.equal(false); // owner can operate on alice's tokens
      expect(await erc1155yul.isApprovedForAll(bob.address, owner.address)).to.equal(true); // owner can operate on bob's tokens

      // now try as owner to transfer from Alice's funds
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      await expect(erc1155yul.safeTransferFrom(alice.address, bob.address, 1, 1)).to.be.reverted;

      // nothing happened
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);
    });

    it("Should allow the owner of tokens to safeTransferFrom to wherever", async () => {
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);

      expect(await erc1155yul.isApprovedForAll(alice.address, owner.address)).to.equal(false); // owner can operate on alice's tokens
      expect(await erc1155yul.isApprovedForAll(alice.address, bob.address)).to.equal(false); // owner can operate on alice's tokens
      //
      expect(await erc1155yul.isApprovedForAll(bob.address, owner.address)).to.equal(false); // owner can operate on alice's tokens
      expect(await erc1155yul.isApprovedForAll(bob.address, alice.address)).to.equal(false); // owner can operate on alice's tokens
      //
      expect(await erc1155yul.isApprovedForAll(owner.address, alice.address)).to.equal(false); // owner can operate on alice's tokens
      expect(await erc1155yul.isApprovedForAll(owner.address, bob.address)).to.equal(false); // owner can operate on alice's tokens

      tx = await erc1155yul.mint(alice.address, 1, 1);
      await tx.wait();
      tx = await erc1155yul.mint(bob.address, 1, 1);
      await tx.wait();
      tx = await erc1155yul.mint(owner.address, 1, 1);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);

      // don't set approval for anyone ...
      // who can transfer now?
      await expect(erc1155yul.connect(owner).safeTransferFrom(alice.address, bob.address, 1, 1)).to.be.reverted;
      await expect(erc1155yul.connect(owner).safeTransferFrom(bob.address, alice.address, 1, 1)).to.be.reverted;

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);

      await expect(erc1155yul.connect(alice).safeTransferFrom(owner.address, bob.address, 1, 1)).to.be.reverted;
      await expect(erc1155yul.connect(alice).safeTransferFrom(bob.address, owner.address, 1, 1)).to.be.reverted;

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);

      await expect(erc1155yul.connect(bob).safeTransferFrom(alice.address, owner.address, 1, 1)).to.be.reverted;
      await expect(erc1155yul.connect(bob).safeTransferFrom(owner.address, alice.address, 1, 1)).to.be.reverted;

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);

      // now try sending from ourselves, that should work
      expect(await erc1155yul.isApprovedForAll(alice.address, bob.address)).to.equal(false); // bob cannot operate on alice's tokens to be sure
      expect(await erc1155yul.isApprovedForAll(bob.address, alice.address)).to.equal(false); // alice cannot operate on bob's tokens

      tx = await erc1155yul.connect(alice).safeTransferFrom(alice.address, bob.address, 1, 1); // connect as alice and send her token to bob
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);

      await expect(erc1155yul.connect(alice).safeTransferFrom(bob.address, alice.address, 1, 1)); // try to reclaim them ... can't be done

      tx = await erc1155yul.connect(bob).safeTransferFrom(bob.address, owner.address, 1, 1);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(2);

      tx = await erc1155yul.safeTransferFrom(owner.address, alice.address, 1, 1);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);
    });

    it("Should safeBatchTransferFrom correctly", async () => {

      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 2)).to.equal(0);
      //
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(0);
      //
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(0);

      tx = await erc1155yul.mint(owner.address, 1, 4);
      tx = await erc1155yul.mint(owner.address, 2, 8);
      await tx.wait();

      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(4);
      expect(await erc1155yul.balanceOf(owner.address, 2)).to.equal(8);
      //
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(0);
      //
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(0);

      tx = await erc1155yul.safeBatchTransferFrom(owner.address, bob.address, [1, 2], [1, 1]);
      await tx.wait();

      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(3);
      expect(await erc1155yul.balanceOf(owner.address, 2)).to.equal(7);
      //
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(0);
      //
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(1);

      // cant move what we dont have
      await expect(erc1155yul.safeBatchTransferFrom(alice.address, bob.address, [1, 2], [1, 1])).to.be.reverted;
      
      tx = await erc1155yul.safeBatchTransferFrom(owner.address, alice.address, [1, 2], [2, 2]);
      await tx.wait();

      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 2)).to.equal(5);
      //
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(2);
      //
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(1);

      // can move one at a time
      tx = await erc1155yul.safeBatchTransferFrom(owner.address, alice.address, [2], [1]);
      await tx.wait();

      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(owner.address, 2)).to.equal(4);
      //
      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(alice.address, 2)).to.equal(3);
      //
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(1);
    });

    it("Should allow minting to a contract with implemented receiver interface", async () => {

      expect(await erc1155yul.balanceOf(receiver.address, 1)).to.equal(0);

      let tx = await erc1155yul.mint(receiver.address, 1, 1);
      await tx.wait();

      expect(await erc1155yul.balanceOf(receiver.address, 1)).to.equal(1);
    });

    it("Should not allow sending to a contract that does not support the receiver interface", async () => {
      expect(await erc1155yul.balanceOf(noreceiver.address, 1)).to.equal(0);
      await expect(erc1155yul.mint(noreceiver.address, 1, 1)).to.be.reverted; // try minting to the noreceiver one
      expect(await erc1155yul.balanceOf(noreceiver.address, 1)).to.equal(0);

      // but the receiver contract works
      expect(await erc1155yul.balanceOf(noreceiver.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 1)).to.equal(0);

      // mint to the receiver one
      let tx = await erc1155yul.mint(receiver.address, 1, 1);
      await tx.wait();

      expect(await erc1155yul.balanceOf(noreceiver.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 1)).to.equal(1);
    });

    it("Should enforce the receiver interface for safeTransferFrom", async () => {
      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      tx = await erc1155yul.mint(alice.address, 0, 4);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(4);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      await expect(erc1155yul.connect(alice).safeTransferFrom(alice.address, noreceiver.address, 0, 1)).to.be.reverted;

      // nothing should change
      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(4);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      // try transferring to receiver -- that should work!
      tx = await erc1155yul.connect(alice).safeTransferFrom(alice.address, receiver.address, 0, 2);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(2);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(2);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      tx = await erc1155yul.mint(bob.address, 1, 2);
      await tx.wait();

      tx = await erc1155yul.connect(bob).safeTransferFrom(bob.address, receiver.address, 1, 1);
      await tx.wait();

      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(2);
      expect(await erc1155yul.balanceOf(receiver.address, 1)).to.equal(1);
    });

    it("Should enforce the receiver interface for safeBatchTransferFrom", async () => {
      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      tx = await erc1155yul.mint(alice.address, 0, 4);
      await tx.wait();
      tx = await erc1155yul.mint(alice.address, 1, 2);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(4);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      await expect(erc1155yul.connect(alice).safeBatchTransferFrom(alice.address, noreceiver.address, [0, 1], [1, 1])).to.be.reverted;
      
      // nothing should change
      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(4);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      tx = await erc1155yul.connect(alice).safeBatchTransferFrom(alice.address, receiver.address, [0, 1], [1, 1]);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(3);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(1);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 1)).to.equal(1);
      expect(await erc1155yul.balanceOf(noreceiver.address, 1)).to.equal(0);
    });

    it.only("Should enforce the receiver interface for mintBatch", async () => {
      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      tx = await erc1155yul.mintBatch(alice.address, [0, 1], [4, 2]);
      await tx.wait();
      tx = await erc1155yul.mintBatch(bob.address, [1, 2], [2, 2]);
      await tx.wait();

      expect(await erc1155yul.balanceOf(alice.address, 0)).to.equal(4);
      expect(await erc1155yul.balanceOf(bob.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(owner.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 0)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 0)).to.equal(0);

      expect(await erc1155yul.balanceOf(alice.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(bob.address, 1)).to.equal(2);
      expect(await erc1155yul.balanceOf(bob.address, 2)).to.equal(2);
      expect(await erc1155yul.balanceOf(owner.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(receiver.address, 1)).to.equal(0);
      expect(await erc1155yul.balanceOf(noreceiver.address, 1)).to.equal(0);
    });

  }); // end of deployed code tests
}); // end of all tests