// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract JunoNft is ERC721, Ownable {
    uint256 private _nftIdCounter;

    constructor(string memory name, string memory symbol) ERC721(name, symbol) Ownable(msg.sender) {}

    function mint(address to) external onlyOwner {
        _nftIdCounter += 1;
        _safeMint(to, _nftIdCounter);
    }
}
