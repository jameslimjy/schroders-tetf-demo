// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title TES3 - Tokenized SPDR STI ETF
 * @notice ERC-20 token representing tokenized ES3 shares
 * @dev Tokenized version of SPDR Straits Times Index ETF
 * 
 * Key Features:
 * - Standard ERC-20 functionality (transfer, approve, transferFrom, balanceOf)
 * - Mint/burn functions restricted to dCDP contract only
 * - 18 decimals allows fractional ownership (e.g., 5.5 TES3)
 * - Name: "Tokenized SPDR STI ETF"
 * - Symbol: "TES3"
 * 
 * The dCDP contract can mint tokens when traditional ES3 shares are tokenized
 * and burn tokens when tokens are redeemed back to traditional shares.
 */
contract TES3 is ERC20, Ownable {
    // Address of the dCDP contract that can mint/burn tokens
    address public dCDP;

    // Event emitted when dCDP address is updated
    event DCDPUpdated(address indexed oldDCDP, address indexed newDCDP);

    /**
     * @notice Constructor sets initial owner and dCDP address
     * @param initialOwner Address that will own the contract and can update dCDP
     * @param initialDCDP Address of the dCDP contract that can mint/burn
     * @dev Allows zero address for initialDCDP to enable deployment before dCDP is deployed
     *      Must call setDCDP() after dCDP deployment
     */
    constructor(address initialOwner, address initialDCDP) ERC20("Tokenized SPDR STI ETF", "TES3") Ownable(initialOwner) {
        dCDP = initialDCDP;
        if (initialDCDP != address(0)) {
            emit DCDPUpdated(address(0), initialDCDP);
        }
    }

    /**
     * @notice Modifier to restrict functions to dCDP contract only
     */
    modifier onlyDCDP() {
        require(msg.sender == dCDP, "TES3: caller is not the dCDP contract");
        _;
    }

    /**
     * @notice Mint new TES3 tokens to a specified address
     * @dev Only callable by the dCDP contract
     * Used when traditional ES3 shares are tokenized (lock-and-mint mechanism)
     * @param to Address to receive the minted tokens
     * @param amount Amount of tokens to mint (in wei, 18 decimals)
     */
    function mint(address to, uint256 amount) external onlyDCDP {
        require(to != address(0), "TES3: cannot mint to zero address");
        _mint(to, amount);
    }

    /**
     * @notice Burn TES3 tokens from a specified address
     * @dev Only callable by the dCDP contract
     * Used when tokenized shares are redeemed back to traditional shares
     * @param from Address to burn tokens from
     * @param amount Amount of tokens to burn (in wei, 18 decimals)
     */
    function burn(address from, uint256 amount) external onlyDCDP {
        require(from != address(0), "TES3: cannot burn from zero address");
        _burn(from, amount);
    }

    /**
     * @notice Update the dCDP contract address
     * @dev Only callable by the contract owner
     * @param newDCDP Address of the new dCDP contract
     */
    function setDCDP(address newDCDP) external onlyOwner {
        require(newDCDP != address(0), "TES3: dCDP cannot be zero address");
        address oldDCDP = dCDP;
        dCDP = newDCDP;
        emit DCDPUpdated(oldDCDP, newDCDP);
    }
}

