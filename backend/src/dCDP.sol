// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./TES3.sol";

/**
 * @title dCDP - Decentralized Central Depository Protocol
 * @notice Protocol contract managing tokenization, wallet creation, and CDP integration
 * @dev Manages the lock-and-mint mechanism for tokenizing traditional securities
 * 
 * Key Features:
 * - Maps owner_id (string) to Ethereum wallet addresses
 * - Tokenizes traditional securities (ES3) into tokenized tokens (TES3)
 * - Creates wallets for new users
 * - Emits events for tracking tokenization and wallet creation
 * 
 * Note: CDP registry verification happens offchain before calling tokenize()
 * The contract trusts that offchain validation has occurred and mints tokens accordingly
 */
contract dCDP is Ownable {
    // Reference to the TES3 token contract
    TES3 public tes3Token;

    // Mapping from owner_id (string) to Ethereum address
    // Used to track which wallet belongs to which user
    mapping(string => address) public ownerToAddress;

    // Mapping from Ethereum address to owner_id (string)
    // Reverse mapping for convenience
    mapping(address => string) public addressToOwner;

    // Event emitted when a new wallet is created
    event WalletCreated(string indexed owner_id, address indexed walletAddress);

    // Event emitted when securities are tokenized
    event Tokenized(
        string indexed owner_id,
        string symbol,
        uint256 quantity,
        address indexed tokenAddress
    );

    // Event emitted when tokenized securities are redeemed
    event Redeemed(
        string indexed owner_id,
        string symbol,
        uint256 quantity,
        address indexed tokenAddress
    );

    /**
     * @notice Constructor sets initial owner and TES3 token address
     * @param initialOwner Address that will own the contract (dCDP admin)
     * @param tes3TokenAddress Address of the TES3 token contract
     */
    constructor(address initialOwner, address tes3TokenAddress) Ownable(initialOwner) {
        require(tes3TokenAddress != address(0), "dCDP: TES3 token address cannot be zero");
        tes3Token = TES3(tes3TokenAddress);
    }

    /**
     * @notice Modifier to restrict functions to admin (owner) only
     */
    modifier onlyAdmin() {
        require(msg.sender == owner(), "dCDP: caller is not the admin");
        _;
    }

    /**
     * @notice Create a wallet mapping for a new user
     * @dev Only callable by admin
     * Used when digital exchange creates account for new user
     * @param owner_id String identifier for the owner (e.g., "THOMAS", "AP")
     * @param walletAddress Ethereum address associated with this owner_id
     */
    function createWallet(string memory owner_id, address walletAddress) external onlyAdmin {
        require(walletAddress != address(0), "dCDP: wallet address cannot be zero");
        require(bytes(owner_id).length > 0, "dCDP: owner_id cannot be empty");
        require(ownerToAddress[owner_id] == address(0), "dCDP: owner_id already has a wallet");
        require(bytes(addressToOwner[walletAddress]).length == 0, "dCDP: address already registered");

        ownerToAddress[owner_id] = walletAddress;
        addressToOwner[walletAddress] = owner_id;

        emit WalletCreated(owner_id, walletAddress);
    }

    /**
     * @notice Tokenize traditional securities into tokenized tokens
     * @dev Only callable by admin
     * 
     * IMPORTANT: This function assumes offchain validation has occurred:
     * - CDP registry has been checked for sufficient balance
     * - CDP registry has been updated to decrease traditional balance
     * 
     * This function only mints the corresponding TES3 tokens onchain
     * 
     * @param owner_id String identifier for the owner (e.g., "AP")
     * @param quantity Amount of tokens to mint (in wei, 18 decimals)
     * @param symbol Symbol of the security being tokenized (only "ES3" supported in this demo)
     */
    function tokenize(
        string memory owner_id,
        uint256 quantity,
        string memory symbol
    ) external onlyAdmin {
        require(bytes(owner_id).length > 0, "dCDP: owner_id cannot be empty");
        require(quantity > 0, "dCDP: quantity must be greater than zero");
        require(bytes(symbol).length > 0, "dCDP: symbol cannot be empty");
        
        // Verify owner_id has a registered wallet
        address ownerAddress = ownerToAddress[owner_id];
        require(ownerAddress != address(0), "dCDP: owner_id does not have a registered wallet");

        // Currently only ES3 is supported in this demo
        // In production, this would check symbol and route to appropriate token contract
        require(
            keccak256(bytes(symbol)) == keccak256(bytes("ES3")),
            "dCDP: only ES3 tokenization is supported"
        );

        // Mint TES3 tokens to the owner's address
        tes3Token.mint(ownerAddress, quantity);

        // Emit event for tracking
        emit Tokenized(owner_id, symbol, quantity, address(tes3Token));
    }

    /**
     * @notice Redeem tokenized tokens back to traditional securities
     * @dev Only callable by admin
     * 
     * IMPORTANT: This function assumes offchain validation will occur:
     * - CDP registry will be updated to increase traditional balance
     * 
     * This function only burns the corresponding TES3 tokens onchain
     * 
     * @param owner_id String identifier for the owner (e.g., "AP")
     * @param quantity Amount of tokens to burn (in wei, 18 decimals)
     * @param symbol Symbol of the security being redeemed (only "ES3" supported in this demo)
     */
    function redeem(
        string memory owner_id,
        uint256 quantity,
        string memory symbol
    ) external onlyAdmin {
        require(bytes(owner_id).length > 0, "dCDP: owner_id cannot be empty");
        require(quantity > 0, "dCDP: quantity must be greater than zero");
        require(bytes(symbol).length > 0, "dCDP: symbol cannot be empty");
        
        // Verify owner_id has a registered wallet
        address ownerAddress = ownerToAddress[owner_id];
        require(ownerAddress != address(0), "dCDP: owner_id does not have a registered wallet");

        // Currently only ES3 is supported in this demo
        require(
            keccak256(bytes(symbol)) == keccak256(bytes("ES3")),
            "dCDP: only ES3 redemption is supported"
        );

        // Check if owner has sufficient TES3 tokens
        uint256 balance = tes3Token.balanceOf(ownerAddress);
        require(balance >= quantity, "dCDP: insufficient TES3 balance");

        // Burn TES3 tokens from the owner's address
        tes3Token.burn(ownerAddress, quantity);

        // Emit event for tracking
        emit Redeemed(owner_id, symbol, quantity, address(tes3Token));
    }

    /**
     * @notice Get the Ethereum address for a given owner_id
     * @param owner_id String identifier for the owner
     * @return The Ethereum address associated with this owner_id, or zero address if not found
     */
    function getAddress(string memory owner_id) external view returns (address) {
        return ownerToAddress[owner_id];
    }

    /**
     * @notice Get the owner_id for a given Ethereum address
     * @param walletAddress Ethereum address to look up
     * @return The owner_id string associated with this address, or empty string if not found
     */
    function getOwnerId(address walletAddress) external view returns (string memory) {
        return addressToOwner[walletAddress];
    }

    /**
     * @notice Update the TES3 token contract address
     * @dev Only callable by admin
     * @param newTES3TokenAddress Address of the new TES3 token contract
     */
    function setTES3Token(address newTES3TokenAddress) external onlyAdmin {
        require(newTES3TokenAddress != address(0), "dCDP: TES3 token address cannot be zero");
        tes3Token = TES3(newTES3TokenAddress);
    }
}

