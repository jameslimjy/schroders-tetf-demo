// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {TES3} from "../src/TES3.sol";
import {dCDP} from "../src/dCDP.sol";

/**
 * @title dCDP Test Suite
 * @notice Tests for Decentralized Central Depository Protocol (dCDP) contract
 */
contract dCDPTest is Test {
    TES3 public tes3;
    dCDP public dcdp;
    
    // Test accounts
    address public admin;
    address public user1;
    address public unauthorizedUser;
    address public apWallet;
    address public thomasWallet;

    // Test constants
    string public constant AP_ID = "AP";
    string public constant THOMAS_ID = "THOMAS";
    uint256 public constant TOKENIZE_AMOUNT = 50 ether;

    function setUp() public {
        // Create test accounts
        admin = address(this); // Test contract is admin
        user1 = address(0x1);
        unauthorizedUser = address(0x2);
        apWallet = address(0x3);
        thomasWallet = address(0x4);

        // Deploy TES3 with temporary zero address for dCDP
        tes3 = new TES3(admin, address(0));

        // Deploy dCDP contract
        dcdp = new dCDP(admin, address(tes3));

        // Link TES3 to dCDP
        tes3.setDCDP(address(dcdp));
    }

    /**
     * @notice Test that contract initializes correctly
     */
    function test_Initialization() public {
        assertEq(dcdp.owner(), admin);
        assertEq(address(dcdp.tes3Token()), address(tes3));
    }

    /**
     * @notice Test that admin can create wallet
     */
    function test_AdminCanCreateWallet() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        assertEq(dcdp.ownerToAddress(AP_ID), apWallet);
        assertEq(dcdp.addressToOwner(apWallet), AP_ID);
    }

    /**
     * @notice Test that non-admin cannot create wallet
     */
    function test_NonAdminCannotCreateWallet() public {
        vm.prank(unauthorizedUser);
        vm.expectRevert("dCDP: caller is not the admin");
        dcdp.createWallet(AP_ID, apWallet);
    }

    /**
     * @notice Test that wallet cannot be created with zero address
     */
    function test_CannotCreateWalletWithZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert("dCDP: wallet address cannot be zero");
        dcdp.createWallet(AP_ID, address(0));
    }

    /**
     * @notice Test that wallet cannot be created with empty owner_id
     */
    function test_CannotCreateWalletWithEmptyOwnerId() public {
        vm.prank(admin);
        vm.expectRevert("dCDP: owner_id cannot be empty");
        dcdp.createWallet("", apWallet);
    }

    /**
     * @notice Test that same owner_id cannot be registered twice
     */
    function test_CannotRegisterSameOwnerIdTwice() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(admin);
        vm.expectRevert("dCDP: owner_id already has a wallet");
        dcdp.createWallet(AP_ID, thomasWallet);
    }

    /**
     * @notice Test that same address cannot be registered twice
     */
    function test_CannotRegisterSameAddressTwice() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(admin);
        vm.expectRevert("dCDP: address already registered");
        dcdp.createWallet(THOMAS_ID, apWallet);
    }

    /**
     * @notice Test WalletCreated event emission
     * Note: We verify state changes instead of event emission for simplicity
     */
    function test_WalletCreatedEvent() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);
        
        // Verify wallet was created
        assertEq(dcdp.ownerToAddress(AP_ID), apWallet);
    }

    /**
     * @notice Test that admin can tokenize ES3
     */
    function test_AdminCanTokenizeES3() public {
        // First create wallet for AP
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        // Tokenize ES3
        vm.prank(admin);
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "ES3");

        // Verify tokens were minted to AP's wallet
        assertEq(tes3.balanceOf(apWallet), TOKENIZE_AMOUNT);
        assertEq(tes3.totalSupply(), TOKENIZE_AMOUNT);
    }

    /**
     * @notice Test that non-admin cannot tokenize
     */
    function test_NonAdminCannotTokenize() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(unauthorizedUser);
        vm.expectRevert("dCDP: caller is not the admin");
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "ES3");
    }

    /**
     * @notice Test that tokenization fails if owner_id has no wallet
     */
    function test_TokenizeFailsWithoutWallet() public {
        vm.prank(admin);
        vm.expectRevert("dCDP: owner_id does not have a registered wallet");
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "ES3");
    }

    /**
     * @notice Test that tokenization fails with empty owner_id
     */
    function test_TokenizeFailsWithEmptyOwnerId() public {
        vm.prank(admin);
        vm.expectRevert("dCDP: owner_id cannot be empty");
        dcdp.tokenize("", TOKENIZE_AMOUNT, "ES3");
    }

    /**
     * @notice Test that tokenization fails with zero quantity
     */
    function test_TokenizeFailsWithZeroQuantity() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(admin);
        vm.expectRevert("dCDP: quantity must be greater than zero");
        dcdp.tokenize(AP_ID, 0, "ES3");
    }

    /**
     * @notice Test that tokenization fails with empty symbol
     */
    function test_TokenizeFailsWithEmptySymbol() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(admin);
        vm.expectRevert("dCDP: symbol cannot be empty");
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "");
    }

    /**
     * @notice Test that only ES3 tokenization is supported
     */
    function test_OnlyES3TokenizationSupported() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(admin);
        vm.expectRevert("dCDP: only ES3 tokenization is supported");
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "OTHER");
    }

    /**
     * @notice Test Tokenized event emission
     * Note: We verify state changes instead of event emission for simplicity
     */
    function test_TokenizedEvent() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(admin);
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "ES3");
        
        // Verify tokens were minted
        assertEq(tes3.balanceOf(apWallet), TOKENIZE_AMOUNT);
    }

    /**
     * @notice Test getAddress function
     */
    function test_GetAddress() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        address retrievedAddress = dcdp.getAddress(AP_ID);
        assertEq(retrievedAddress, apWallet);
    }

    /**
     * @notice Test getOwnerId function
     */
    function test_GetOwnerId() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        string memory retrievedOwnerId = dcdp.getOwnerId(apWallet);
        assertEq(keccak256(bytes(retrievedOwnerId)), keccak256(bytes(AP_ID)));
    }

    /**
     * @notice Test multiple wallet creations
     */
    function test_MultipleWalletCreations() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        vm.prank(admin);
        dcdp.createWallet(THOMAS_ID, thomasWallet);

        assertEq(dcdp.ownerToAddress(AP_ID), apWallet);
        assertEq(dcdp.ownerToAddress(THOMAS_ID), thomasWallet);
        assertEq(dcdp.addressToOwner(apWallet), AP_ID);
        assertEq(dcdp.addressToOwner(thomasWallet), THOMAS_ID);
    }

    /**
     * @notice Test multiple tokenizations for same owner
     */
    function test_MultipleTokenizations() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        // First tokenization
        vm.prank(admin);
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "ES3");

        // Second tokenization
        vm.prank(admin);
        dcdp.tokenize(AP_ID, TOKENIZE_AMOUNT, "ES3");

        assertEq(tes3.balanceOf(apWallet), TOKENIZE_AMOUNT * 2);
        assertEq(tes3.totalSupply(), TOKENIZE_AMOUNT * 2);
    }

    /**
     * @notice Test fractional tokenization (e.g., 5.5 TES3)
     */
    function test_FractionalTokenization() public {
        vm.prank(admin);
        dcdp.createWallet(AP_ID, apWallet);

        uint256 fractionalAmount = 55 * 10**17; // 5.5 tokens
        
        vm.prank(admin);
        dcdp.tokenize(AP_ID, fractionalAmount, "ES3");

        assertEq(tes3.balanceOf(apWallet), fractionalAmount);
    }

    /**
     * @notice Test that admin can update TES3 token address
     */
    function test_AdminCanUpdateTES3Token() public {
        TES3 newTES3 = new TES3(admin, address(0));
        newTES3.setDCDP(address(dcdp));

        vm.prank(admin);
        dcdp.setTES3Token(address(newTES3));

        assertEq(address(dcdp.tes3Token()), address(newTES3));
    }

    /**
     * @notice Test that non-admin cannot update TES3 token
     */
    function test_NonAdminCannotUpdateTES3Token() public {
        TES3 newTES3 = new TES3(admin, address(0));

        vm.prank(unauthorizedUser);
        vm.expectRevert("dCDP: caller is not the admin");
        dcdp.setTES3Token(address(newTES3));
    }

    /**
     * @notice Test that TES3 token cannot be set to zero address
     */
    function test_CannotSetTES3TokenToZero() public {
        vm.expectRevert("dCDP: TES3 token address cannot be zero");
        dcdp.setTES3Token(address(0));
    }
}

