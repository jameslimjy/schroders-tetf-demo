// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {SGDC} from "../src/SGDC.sol";

/**
 * @title SGDC Test Suite
 * @notice Tests for Singapore Dollar Coin (SGDC) stablecoin contract
 */
contract SGDCTest is Test {
    SGDC public sgdc;
    
    // Test accounts
    address public admin;
    address public minter;
    address public user1;
    address public user2;

    // Test constants
    uint256 public constant INITIAL_MINT_AMOUNT = 1000 ether;
    uint256 public constant TRANSFER_AMOUNT = 100 ether;

    function setUp() public {
        // Create test accounts
        admin = address(this); // Test contract is admin
        minter = address(0x1);
        user1 = address(0x2);
        user2 = address(0x3);

        // Deploy SGDC contract
        sgdc = new SGDC(admin, minter);
    }

    /**
     * @notice Test that contract initializes correctly
     */
    function test_Initialization() public {
        assertEq(sgdc.name(), "Singapore Dollar Coin");
        assertEq(sgdc.symbol(), "SGDC");
        assertEq(sgdc.decimals(), 18);
        assertEq(sgdc.minter(), minter);
        assertEq(sgdc.owner(), admin);
        assertEq(sgdc.totalSupply(), 0);
    }

    /**
     * @notice Test that minter can mint tokens
     */
    function test_MinterCanMint() public {
        vm.prank(minter);
        sgdc.mint(user1, INITIAL_MINT_AMOUNT);

        assertEq(sgdc.balanceOf(user1), INITIAL_MINT_AMOUNT);
        assertEq(sgdc.totalSupply(), INITIAL_MINT_AMOUNT);
    }

    /**
     * @notice Test that non-minter cannot mint
     */
    function test_NonMinterCannotMint() public {
        vm.prank(user1);
        vm.expectRevert("SGDC: caller is not the minter");
        sgdc.mint(user2, INITIAL_MINT_AMOUNT);
    }

    /**
     * @notice Test that minting to zero address fails
     */
    function test_MintToZeroAddressFails() public {
        vm.prank(minter);
        vm.expectRevert("SGDC: cannot mint to zero address");
        sgdc.mint(address(0), INITIAL_MINT_AMOUNT);
    }

    /**
     * @notice Test standard ERC-20 transfer functionality
     */
    function test_Transfer() public {
        // Mint tokens to user1
        vm.prank(minter);
        sgdc.mint(user1, INITIAL_MINT_AMOUNT);

        // User1 transfers to user2
        vm.prank(user1);
        sgdc.transfer(user2, TRANSFER_AMOUNT);

        assertEq(sgdc.balanceOf(user1), INITIAL_MINT_AMOUNT - TRANSFER_AMOUNT);
        assertEq(sgdc.balanceOf(user2), TRANSFER_AMOUNT);
    }

    /**
     * @notice Test that owner can update minter
     */
    function test_OwnerCanUpdateMinter() public {
        address newMinter = address(0x4);
        
        sgdc.setMinter(newMinter);
        
        assertEq(sgdc.minter(), newMinter);
    }

    /**
     * @notice Test that non-owner cannot update minter
     */
    function test_NonOwnerCannotUpdateMinter() public {
        address newMinter = address(0x4);
        
        vm.prank(user1);
        vm.expectRevert();
        sgdc.setMinter(newMinter);
    }

    /**
     * @notice Test that minter cannot be set to zero address
     */
    function test_CannotSetMinterToZero() public {
        vm.expectRevert("SGDC: minter cannot be zero address");
        sgdc.setMinter(address(0));
    }

    /**
     * @notice Test multiple mints accumulate correctly
     */
    function test_MultipleMints() public {
        vm.prank(minter);
        sgdc.mint(user1, 100 ether);
        
        vm.prank(minter);
        sgdc.mint(user1, 200 ether);
        
        vm.prank(minter);
        sgdc.mint(user2, 300 ether);

        assertEq(sgdc.balanceOf(user1), 300 ether);
        assertEq(sgdc.balanceOf(user2), 300 ether);
        assertEq(sgdc.totalSupply(), 600 ether);
    }

    /**
     * @notice Test approve and transferFrom functionality
     */
    function test_ApproveAndTransferFrom() public {
        // Mint tokens to user1
        vm.prank(minter);
        sgdc.mint(user1, INITIAL_MINT_AMOUNT);

        // User1 approves user2 to spend tokens
        vm.prank(user1);
        sgdc.approve(user2, TRANSFER_AMOUNT);
        
        assertEq(sgdc.allowance(user1, user2), TRANSFER_AMOUNT);

        // User2 transfers from user1
        vm.prank(user2);
        sgdc.transferFrom(user1, user2, TRANSFER_AMOUNT);

        assertEq(sgdc.balanceOf(user1), INITIAL_MINT_AMOUNT - TRANSFER_AMOUNT);
        assertEq(sgdc.balanceOf(user2), TRANSFER_AMOUNT);
        assertEq(sgdc.allowance(user1, user2), 0);
    }
}

