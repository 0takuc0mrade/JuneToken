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

    const [manager, account1, account2] = await hre.ethers.getSigners();

    // Deploy JunoToken (ERC20)
    const JunoToken = await hre.ethers.getContractFactory('JunoToken');
    const junoToken = await JunoToken.deploy();
    await junoToken.waitForDeployment();

    // Distribute tokens to accounts
    await junoToken.transfer(account1.address, ethers.parseEther('10'));
    await junoToken.transfer(account2.address, ethers.parseEther('10'));

    // Deploy JunoNft (ERC721)
    const JunoNft = await hre.ethers.getContractFactory('JunoNft');
    const junoNft = await JunoNft.deploy('JunoNFT', 'JNFT');
    await junoNft.waitForDeployment();

    // Deploy PiggyBank
    const PiggyBank = await hre.ethers.getContractFactory('PiggyBank');
    const piggyBank = await PiggyBank.deploy(
      targetAmount,
      withdrawalDate,
      manager.address,
    );
    await piggyBank.waitForDeployment();

    // Link Token and NFT contracts to PiggyBank
    await piggyBank
      .connect(manager)
      .setTokenAddress(await junoToken.getAddress());
    await piggyBank.connect(manager).setNftAddress(await junoNft.getAddress());

    // After deploying PiggyBank and JunoNft
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
    it('should deploy all contracts correctly', async () => {
      const { piggyBank, manager } = await loadFixture(deployContracts);
      expect(await piggyBank.manager()).to.equal(manager.address);
    });
  });

  describe('Contributions', () => {
    it('should allow users to contribute tokens', async () => {
      const { piggyBank, junoToken, account1 } = await loadFixture(
        deployContracts,
      );

      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), ethers.parseEther('1'));
      await piggyBank.connect(account1).save({ value: ethers.parseEther('1') });

      expect(await piggyBank.contributions(account1.address)).to.equal(
        ethers.parseEther('1'),
      );
    });

    it('should mint an NFT after second contribution of 1 token', async () => {
      const { piggyBank, junoToken, junoNft, account1 } = await loadFixture(
        deployContracts,
      );

      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), ethers.parseEther('2'));

      // First Contribution
      await piggyBank.connect(account1).save({ value: ethers.parseEther('1') });
      // Second Contribution
      await piggyBank.connect(account1).save({ value: ethers.parseEther('1') });

      expect(await junoNft.balanceOf(account1.address)).to.equal(1);
    });
  });

  describe('Withdrawals', () => {
    it('should allow manager to withdraw after target is met and withdrawal date is reached', async () => {
      const {
        piggyBank,
        junoToken,
        manager,
        account1,
        withdrawalDate,
        targetAmount,
      } = await loadFixture(deployContracts);

      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), ethers.parseEther('1'));
      await piggyBank.connect(account1).save({ value: ethers.parseEther('1') });

      await time.increaseTo(withdrawalDate);

      const latestBlockTimestamp = await time.latest();

      await expect(piggyBank.connect(manager).withdrawal())
        .to.emit(piggyBank, 'Withdrawn')
        .withArgs(ethers.parseEther('1'), latestBlockTimestamp);

      expect(await junoToken.balanceOf(manager.address)).to.equal(
        ethers.parseEther('1'),
      );
    });

    it('should prevent withdrawals before the withdrawal date', async () => {
      const { piggyBank, junoToken, manager, account1 } = await loadFixture(
        deployContracts,
      );

      await junoToken
        .connect(account1)
        .approve(await piggyBank.getAddress(), ethers.parseEther('1'));
      await piggyBank.connect(account1).save({ value: ethers.parseEther('1') });

      await expect(piggyBank.connect(manager).withdrawal()).to.be.revertedWith(
        'NOT YET TIME',
      );
    });

    it('should prevent non-managers from withdrawing', async () => {
      const { piggyBank, account1, withdrawalDate } = await loadFixture(
        deployContracts,
      );

      await time.increaseTo(withdrawalDate + 1);

      await expect(piggyBank.connect(account1).withdrawal()).to.be.revertedWith(
        'YOU WAN THIEF ABI ?',
      );
    });
  });
});
