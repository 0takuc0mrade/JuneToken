import {
  time,
  loadFixture,
} from '@nomicfoundation/hardhat-toolbox/network-helpers';
import hre, { ethers } from 'hardhat';
import { expect } from 'chai';

describe('PiggyBank', () => {
  async function deployContracts() {
    const targetAmount = ethers.parseEther('1'); // Target: 1 ETH equivalent in tokens
    const EIGHT_DAYS_IN_SECS = 8 * 24 * 60 * 60;
    const withdrawalDate = (await time.latest()) + EIGHT_DAYS_IN_SECS;

    // Get signers for different roles
    const [manager, account1, account2] = await hre.ethers.getSigners();

    // Deploy JunoToken (ERC20) and distribute initial tokens
    const JunoToken = await hre.ethers.getContractFactory('JunoToken');
    const junoToken = await JunoToken.deploy();
    await junoToken.waitForDeployment();

    // Give test accounts some tokens to work with
    await junoToken.transfer(account1.address, ethers.parseEther('10'));
    await junoToken.transfer(account2.address, ethers.parseEther('10'));

    // Deploy JunoNft (ERC721)
    const JunoNft = await hre.ethers.getContractFactory('JunoNft');
    const junoNft = await JunoNft.deploy('JunoNFT', 'JNFT');
    await junoNft.waitForDeployment();

    // Deploy PiggyBank with our configured parameters
    const PiggyBank = await hre.ethers.getContractFactory('PiggyBank');
    const piggyBank = await PiggyBank.deploy(
      targetAmount,
      withdrawalDate,
      manager.address,
    );
    await piggyBank.waitForDeployment();

    // Set up contract relationships
    await piggyBank
      .connect(manager)
      .setTokenAddress(await junoToken.getAddress());
    await piggyBank.connect(manager).setNftAddress(await junoNft.getAddress());

    // Transfer NFT contract ownership to PiggyBank
    await junoNft
      .connect(manager)
      .transferOwnership(await piggyBank.getAddress());

    return {
      piggyBank,
      junoToken,
      junoNft,
      manager,
      account1,
      account2,
      withdrawalDate,
      targetAmount,
    };
  }

  describe('Deployment', () => {
    it('should deploy all contracts correctly and set up initial state', async () => {
      const { piggyBank, junoToken, junoNft, manager, account1 } =
        await loadFixture(deployContracts);

      // Verify manager is set correctly
      expect(await piggyBank.manager()).to.equal(manager.address);

      // Verify token distributions
      expect(await junoToken.balanceOf(account1.address)).to.equal(
        ethers.parseEther('10'),
      );

      // Verify PiggyBank owns the NFT contract
      expect(await junoNft.owner()).to.equal(await piggyBank.getAddress());
    });
  });

  describe('Contributions', () => {
    it('should allow users to contribute tokens and track their contributions', async () => {
      const { piggyBank, junoToken, account1 } = await loadFixture(
        deployContracts,
      );

      const contributionAmount = ethers.parseEther('1');

      // Approve tokens for transfer
      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), contributionAmount);

      // Make the contribution
      await piggyBank.connect(account1).save(contributionAmount);

      // Verify contribution was recorded
      expect(await piggyBank.contributions(account1.address)).to.equal(
        contributionAmount,
      );

      // Verify tokens were actually transferred
      expect(await junoToken.balanceOf(await piggyBank.getAddress())).to.equal(
        contributionAmount,
      );
    });

    it('should mint an NFT after second contribution and track minting status', async () => {
      const { piggyBank, junoToken, junoNft, account1 } = await loadFixture(
        deployContracts,
      );

      const contributionAmount = ethers.parseEther('1');
      const totalContribution = contributionAmount * 2n;

      // Approve tokens for both contributions
      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), contributionAmount);

      // Make first contribution
      await piggyBank.connect(account1).save(contributionAmount);
      expect(await junoNft.balanceOf(account1.address)).to.equal(0);

      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), contributionAmount);

      // Make second contribution
      await piggyBank.connect(account1).save(contributionAmount);

      // Verify NFT was minted
      expect(await junoNft.balanceOf(account1.address)).to.equal(1);
      expect(await piggyBank.hasMinted(account1.address)).to.be.true;
    });

    it('should not mint additional NFTs for subsequent contributions', async () => {
      const { piggyBank, junoToken, junoNft, account1 } = await loadFixture(
        deployContracts,
      );

      const contributionAmount = ethers.parseEther('1');
      const totalContribution = contributionAmount * 3n; // Three contributions

      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), totalContribution);

      // Make three contributions
      await piggyBank.connect(account1).save(contributionAmount);
      await piggyBank.connect(account1).save(contributionAmount);
      await piggyBank.connect(account1).save(contributionAmount);

      // Verify only one NFT was minted
      expect(await junoNft.balanceOf(account1.address)).to.equal(1);
    });
  });

  describe('Withdrawals', () => {
    it('should allow manager to withdraw after target is met and date is reached', async () => {
      const { piggyBank, junoToken, manager, account1, withdrawalDate } =
        await loadFixture(deployContracts);

      const contributionAmount = ethers.parseEther('1');

      // Make contribution
      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), contributionAmount);
      await piggyBank.connect(account1).save(contributionAmount);

      // Record manager's initial balance
      const initialManagerBalance = await junoToken.balanceOf(manager.address);

      // Advance time to withdrawal date
      await time.increaseTo(withdrawalDate);

      // Perform withdrawal
      const withdrawalTx = await piggyBank.connect(manager).withdrawal();
      const receipt = await withdrawalTx.wait();
      if (!receipt) throw new Error('Transaction receipt is null');

      const block = await ethers.provider.getBlock(receipt.blockNumber);
      if (!block) throw new Error('Block is null');

      // Verify withdrawal event
      await expect(withdrawalTx)
        .to.emit(piggyBank, 'Withdrawn')
        .withArgs(contributionAmount, block.timestamp);

      // Verify tokens were transferred to manager
      const finalManagerBalance = await junoToken.balanceOf(manager.address);
      expect(finalManagerBalance - initialManagerBalance).to.equal(
        contributionAmount,
      );
    });

    it('should prevent withdrawals before the withdrawal date', async () => {
      const { piggyBank, junoToken, manager, account1 } = await loadFixture(
        deployContracts,
      );

      // Make contribution
      const contributionAmount = ethers.parseEther('1');
      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), contributionAmount);
      await piggyBank.connect(account1).save(contributionAmount);

      // Attempt withdrawal before date
      await expect(piggyBank.connect(manager).withdrawal()).to.be.revertedWith(
        'NOT YET TIME',
      );
    });

    it('should prevent non-managers from withdrawing', async () => {
      const { piggyBank, withdrawalDate, account1 } = await loadFixture(
        deployContracts,
      );

      // Advance time to withdrawal date
      await time.increaseTo(withdrawalDate);

      // Attempt withdrawal as non-manager
      await expect(piggyBank.connect(account1).withdrawal()).to.be.revertedWith(
        'YOU WAN THIEF ABI ?',
      );
    });
  });
});
