// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import './JunoToken.sol';
import './JunoNft.sol';

// interface IJuneToken {
//     function totalSupply() external view returns (uint256);
//     function checkBalance(address account) external view returns (uint256);
//     function transfer(address recipient, uint256 amount) external returns (bool);
//     function getAllowance(address owner, address spender) external view returns (uint256);
//     function approve(address spender, uint256 amount) external returns (bool);
//     function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
//     event Transfer(address indexed from, address indexed to, uint256 value);
//     event Approval(address indexed owner, address indexed spender, uint256 value);

// }

interface IJunoToken {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function approve(address spender, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}

interface iJunoNft {
    function mint(address _to) external;
}

contract PiggyBank {

    // state variables
    uint256 public targetAmount;
    mapping(address => uint256) public contributions;
    mapping(address => bool) public hasMinted;
    uint256 public immutable withdrawalDate;
    uint8 public contributorsCount;
    address payable public manager;
    IJunoToken public token;
    iJunoNft public nft;

    // events
    event Contributed (
        address indexed Contributor,
        uint256 amount,
        uint256 time
    );

    event Withdrawn (
        uint256 amount,
        uint256 time
    );

    // constructor
    constructor (uint256 _targetAmount, uint256 _withdrawalDate, address payable _manager) {
        require(_withdrawalDate > block.timestamp, 'WITHDRAWAL MUST BE IN FUTURE');

        targetAmount = _targetAmount;
        withdrawalDate = _withdrawalDate;
        manager = _manager;
        contributorsCount = 0;
    }

    modifier onlyManager () {
        require(msg.sender == manager, 'YOU WAN THIEF ABI ?');
        _;
    }

    function setTokenAddress(address _token) external onlyManager {
        token = IJunoToken(_token);
    }

    function setNftAddress(address _nft) external onlyManager {
        nft = iJunoNft(_nft);
    }


    // save
    function save (uint256 _amount) external{

        require(msg.sender != address(0), 'UNAUTHORIZED ADDRESS');

        require(block.timestamp <= withdrawalDate, 'YOU CAN NO LONGER SAVE');

        require(_amount > 0, 'YOU ARE BROKE');

        // transfer the token to the contract
        token.transferFrom(msg.sender, address(this), _amount);
        // save the contribution
        contributions[msg.sender] += _amount;

        // check if the caller is a first time contributor
        if(contributions[msg.sender] == 0) {
            contributorsCount += 1;
        }

        if(contributions[msg.sender] >= 2 ether && !hasMinted[msg.sender]) {
            nft.mint(msg.sender);
            hasMinted[msg.sender] = true;
        }

        // emit the event
        emit Contributed(msg.sender, _amount, block.timestamp);
    }

    // withdrawal
    function withdrawal () external onlyManager {
        // require that its withdrawal time or greater
        require(block.timestamp >= withdrawalDate, 'NOT YET TIME');

         uint256 _contractBal = token.balanceOf(address(this));

        // require contract bal is > or = targetAmount
        require(_contractBal >= targetAmount, 'TARGET AMOUNT NOT REACHED');

         // transfer to manager
        bool transaction = token.transfer(manager, _contractBal);

        require(transaction, "Transaction Failed");

        emit Withdrawn(_contractBal, block.timestamp);
    }

}