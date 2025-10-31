// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {TES3} from "../src/TES3.sol";
import {dCDP} from "../src/dCDP.sol";

/**
 * @title TES3 Test Suite
 * @notice Tests for Tokenized SPDR STI ETF (TES3) contract
 */
contract TES3Test is Test {
    TES3 public tes3;
    dCDP public dcdp;
    
    // Test accounts
    address public admin;
    address public user1;
    address public user2;
    address public unauthorizedContract;

    // Test constants
    uint256 public constant MINT_AMOUNT = 100 ether;
    uint256 public constant BURN_AMOUNT = 50 ether;
    uint256 public constant TRANSFER_AMOUNT = 25 ether;

    function setUp() public {
        // Create test accounts
        admin = address(this); // Test contract is admin
        user1 = address(0x1);
        user2 = address(0x2);
        unauthorizedContract = address(0x3);

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
        assertEq(tes3.name(), "Tokenized SPDR STI ETF");
        assertEq(tes3.symbol(), "TES3");
        assertEq(tes3.decimals(), 18);
        assertEq(tes3.dCDP(), address(dcdp));
        assertEq(tes3.owner(), admin);
        assertEq(tes3.totalSupply(), 0);
    }

    /**
     * @notice Test that dCDP can mint tokens
     */
    function test_DCDPCanMint() public {
        vm.prank(address(dcdp));
        tes3.mint(user1, MINT_AMOUNT);

        assertEq(tes3.balanceOf(user1), MINT_AMOUNT);
        assertEq(tes3.totalSupply(), MINT_AMOUNT);
    }

    /**
     * @notice Test that non-dCDP cannot mint
     */
    function test_NonDCDPCannotMint() public {
        vm.prank(unauthorizedContract);
        vm.expectRevert("TES3: caller is not the dCDP contract");
        tes3.mint(user1, MINT_AMOUNT);
    }

    /**
     * @notice Test that minting to zero address fails
     */
    function test_MintToZeroAddressFails() public {
        vm.prank(address(dcdp));
        vm.expectRevert("TES3: cannot mint to zero address");
        tes3.mint(address(0), MINT_AMOUNT);
    }

    /**
     * @notice Test that dCDP can burn tokens
     */
    function test_DCDPCanBurn() public {
        // First mint tokens
        vm.prank(address(dcdp));
        tes3.mint(user1, MINT_AMOUNT);

        // Then burn tokens
        vm.prank(address(dcdp));
        tes3.burn(user1, BURN_AMOUNT);

        assertEq(tes3.balanceOf(user1), MINT_AMOUNT - BURN_AMOUNT);
        assertEq(tes3.totalSupply(), MINT_AMOUNT - BURN_AMOUNT);
    }

    /**
     * @notice Test that non-dCDP cannot burn
     */
    function test_NonDCDPCannotBurn() public {
        // First mint tokens
        vm.prank(address(dcdp));
        tes3.mint(user1, MINT_AMOUNT);

        // Try to burn from unauthorized contract
        vm.prank(unauthorizedContract);
        vm.expectRevert("TES3: caller is not the dCDP contract");
        tes3.burn(user1, BURN_AMOUNT);
    }

    /**
     * @notice Test that burning from zero address fails
     */
    function test_BurnFromZeroAddressFails() public {
        vm.prank(address(dcdp));
        vm.expectRevert("TES3: cannot burn from zero address");
        tes3.burn(address(0), BURN_AMOUNT);
    }

    /**
     * @notice Test standard ERC-20 transfer functionality
     */
    function test_Transfer() public {
        // Mint tokens to user1
        vm.prank(address(dcdp));
        tes3.mint(user1, MINT_AMOUNT);

        // User1 transfers to user2
        vm.prank(user1);
        tes3.transfer(user2, TRANSFER_AMOUNT);

        assertEq(tes3.balanceOf(user1), MINT_AMOUNT - TRANSFER_AMOUNT);
        assertEq(tes3.balanceOf(user2), TRANSFER_AMOUNT);
    }

    /**
     * @notice Test fractional token ownership (e.g., 5.5 TES3)
     */
    function test_FractionalOwnership() public {
        // Mint 5.5 tokens (5.5 * 10^18 wei)
        uint256 fractionalAmount = 55 * 10**17; // 5.5 tokens
        
        vm.prank(address(dcdp));
        tes3.mint(user1, fractionalAmount);

        assertEq(tes3.balanceOf(user1), fractionalAmount);
        
        // Transfer 2.3 tokens
        uint256 transferAmount = 23 * 10**17; // 2.3 tokens
        vm.prank(user1);
        tes3.transfer(user2, transferAmount);

        assertEq(tes3.balanceOf(user1), fractionalAmount - transferAmount);
        assertEq(tes3.balanceOf(user2), transferAmount);
    }

    /**
     * @notice Test that owner can update dCDP address
     */
    function test_OwnerCanUpdateDCDP() public {
        address newDCDP = address(0x5);
        
        tes3.setDCDP(newDCDP);
        
        assertEq(tes3.dCDP(), newDCDP);
    }

    /**
     * @notice Test that non-owner cannot update dCDP
     */
    function test_NonOwnerCannotUpdateDCDP() public {
        address newDCDP = address(0x5);
        
        vm.prank(user1);
        vm.expectRevert();
        tes3.setDCDP(newDCDP);
    }

    /**
     * @notice Test that dCDP cannot be set to zero address
     */
    function test_CannotSetDCDPToZero() public {
        vm.expectRevert("TES3: dCDP cannot be zero address");
        tes3.setDCDP(address(0));
    }

    /**
     * @notice Test mint and burn cycle
     */
    function test_MintAndBurnCycle() public {
        // Mint tokens
        vm.prank(address(dcdp));
        tes3.mint(user1, MINT_AMOUNT);
        assertEq(tes3.totalSupply(), MINT_AMOUNT);

        // Burn all tokens
        vm.prank(address(dcdp));
        tes3.burn(user1, MINT_AMOUNT);
        assertEq(tes3.totalSupply(), 0);
        assertEq(tes3.balanceOf(user1), 0);
    }

    /**
     * @notice Test that after dCDP update, new dCDP can mint
     */
    function test_NewDCDPCanMintAfterUpdate() public {
        // Deploy new dCDP
        dCDP newDCDP = new dCDP(admin, address(tes3));
        
        // Update TES3 to point to new dCDP
        tes3.setDCDP(address(newDCDP));
        
        // New dCDP should be able to mint
        vm.prank(address(newDCDP));
        tes3.mint(user1, MINT_AMOUNT);
        
        assertEq(tes3.balanceOf(user1), MINT_AMOUNT);
        
        // Old dCDP should not be able to mint
        vm.prank(address(dcdp));
        vm.expectRevert("TES3: caller is not the dCDP contract");
        tes3.mint(user2, MINT_AMOUNT);
    }
}

