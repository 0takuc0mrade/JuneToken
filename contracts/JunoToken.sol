//SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract JunoToken is ERC20 {
    constructor() ERC20("JunoToken", "JUNO") {
        _mint(msg.sender, 1000000000000000000000000);
    }
}