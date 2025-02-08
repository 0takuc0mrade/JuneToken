// SPDX-License-Identifier: UNLICENSED
pragma solidity 0.8.28;

interface IJuneToken {
    function totalSupply() external view returns (uint256);
    function checkBalance(address account) external view returns (uint256);
    function transfer(address recipient, uint256 amount) external returns (bool);
    function getAllowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool);
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

}

contract PiggyBank {

    // state variables
    uint256 public targetAmount;
    mapping(address => uint256) public contributions;
    uint256 public immutable withdrawalDate;
    uint8 public contributorsCount;
    address public manager;
    IJuneToken public token;

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
    constructor (uint256 _targetAmount, uint256 _withdrawalDate, address _manager) {
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

    // save
    function save () external payable {

        require(msg.sender != address(0), 'UNAUTHORIZED ADDRESS');

        require(block.timestamp <= withdrawalDate, 'YOU CAN NO LONGER SAVE');

        require(msg.value > 0, 'YOU ARE BROKE');

        // check if the caller is a first time contributor
        if(contributions[msg.sender] == 0) {
            contributorsCount += 1;
        }

        // transfer the token to the contract
        token.transferFrom(msg.sender, address(this), msg.value);
        // save the contribution
        contributions[msg.sender] += msg.value;
        // emit the event
        emit Contributed(msg.sender, msg.value, block.timestamp);
    }

    // withdrawal
    function withdrawal () external onlyManager {
        // require that its withdrawal time or greater
        require(block.timestamp >= withdrawalDate, 'NOT YET TIME');

        // require contract bal is > or = targetAmount
        require(address(this).balance >= targetAmount, 'TARGET AMOUNT NOT REACHED');

        uint256 _contractBal = address(this).balance;

        // transfer to manager
        payable(manager).transfer(_contractBal);

        emit Withdrawn(_contractBal, block.timestamp);
    }

}