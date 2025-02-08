//SPDX-License-Identifier: MIT

pragma solidity ^0.8.28;

contract JuneToken{
    string public name = 'JuneToken';
    string public symbol = 'JUNE';
    uint256 public immutable totalSupply = 1000000000000000000000000;
    uint256 public immutable decimals = 18;

    mapping(address => uint) public balances;
    mapping(address => mapping(address => uint)) public allowance;

    event Transfer(address indexed from, address indexed to, uint value);
    event Approval(address indexed owner, address indexed spender, uint value);

    constructor(){
        balances[msg.sender] = totalSupply;
    }

    function checkBalance(address _balance) public view returns(uint256){
        require(_balance != address(0), "Invalid address");
        return balances[_balance];
    }

    function transfer(address _to, uint amount)public returns(bool){
        require(amount <= balances[msg.sender] && balances[msg.sender] > 0, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[_to] += amount;
        emit Transfer(msg.sender, _to, amount);
        return true;
    }

    function approve(address _spender, uint amount) public returns(bool){
        require(amount <= balances[msg.sender], "Insufficient balance");
        allowance[_spender][msg.sender] = amount;
        emit Approval(msg.sender, _spender, amount);
        return true;
    }

     function transferFrom(address _from, address _to, uint amount)public returns(bool){
        require(amount <= allowance[msg.sender][_from], "Insufficient allowance");
        require(amount <= balances[msg.sender] && balances[msg.sender] > 0, "Insufficient balance");
        balances[_from] -= amount;
        balances[_to] += amount;
        allowance[msg.sender][_from] -= amount;
        emit Transfer(_from, _to, amount);
        return true;
    }

    function getAllowance(address _owner, address _spender) public view returns(uint){
        return allowance[_owner][_spender];
    }
}