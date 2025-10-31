// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title SGDC - Singapore Dollar Coin
 * @notice ERC-20 stablecoin token representing Singapore dollars
 * @dev Digital cash for instant settlement in the tokenized ETF system
 * 
 * Key Features:
 * - Standard ERC-20 functionality (transfer, approve, transferFrom, balanceOf)
 * - Minting restricted to authorized minter (stablecoin service provider)
 * - 18 decimals for precision
 * - Name: "Singapore Dollar Coin"
 * - Symbol: "SGDC"
 */
contract SGDC is ERC20, Ownable {
    // Address that has permission to mint new tokens
    address public minter;

    // Event emitted when minter role is transferred
    event MinterUpdated(address indexed oldMinter, address indexed newMinter);

    /**
     * @notice Constructor sets initial owner and minter
     * @param initialOwner Address that will own the contract and can update minter
     * @param initialMinter Address that can mint new SGDC tokens
     */
    constructor(address initialOwner, address initialMinter) ERC20("Singapore Dollar Coin", "SGDC") Ownable(initialOwner) {
        require(initialMinter != address(0), "SGDC: minter cannot be zero address");
        minter = initialMinter;
        emit MinterUpdated(address(0), initialMinter);
    }

    /**
     * @notice Modifier to restrict functions to minter only
     */
    modifier onlyMinter() {
        require(msg.sender == minter, "SGDC: caller is not the minter");
        _;
    }

    /**
     * @notice Mint new SGDC tokens to a specified address
     * @dev Only callable by the minter address
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyMinter {
        require(to != address(0), "SGDC: cannot mint to zero address");
        _mint(to, amount);
    }

    /**
     * @notice Update the minter address
     * @dev Only callable by the contract owner
     * @param newMinter Address of the new minter
     */
    function setMinter(address newMinter) external onlyOwner {
        require(newMinter != address(0), "SGDC: minter cannot be zero address");
        address oldMinter = minter;
        minter = newMinter;
        emit MinterUpdated(oldMinter, newMinter);
    }
}

