// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {SGDC} from "../src/SGDC.sol";
import {TES3} from "../src/TES3.sol";
import {dCDP} from "../src/dCDP.sol";

/**
 * @title Deploy - Deployment script for all contracts
 * @notice Deploys SGDC, TES3, and dCDP contracts with proper configuration
 * 
 * Deployment order:
 * 1. Deploy SGDC (stablecoin) - needs owner and minter addresses
 * 2. Deploy TES3 (tokenized ETF) - needs owner and temporary dCDP address
 * 3. Deploy dCDP (protocol) - needs owner and TES3 address
 * 4. Update TES3 to set correct dCDP address
 * 
 * Three main accounts needed:
 * - Admin: Controls dCDP protocol (deployer)
 * - Stablecoin Provider: Can mint SGDC (can be deployer or separate)
 * - AP, Thomas: Regular users (created via createWallet)
 */
contract DeployScript is Script {
    // Contract instances
    SGDC public sgdc;
    TES3 public tes3;
    dCDP public dcdp;

    // Account addresses (will be set from environment or Anvil defaults)
    address public admin;
    address public stablecoinProvider;

    // AP (Authorized Participant) address - Anvil Account #1
    address public constant AP_ADDRESS = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;

    function setUp() public {
        // Get deployer address (will be msg.sender when running script)
        admin = msg.sender;
        
        // For demo purposes, stablecoin provider can be the same as admin
        // In production, this would be a separate account
        stablecoinProvider = admin;
    }

    function run() public {
        console.log("=== Starting Contract Deployment ===");
        console.log("Admin address:", admin);
        console.log("Stablecoin Provider address:", stablecoinProvider);

        vm.startBroadcast();

        // Step 1: Deploy SGDC (Singapore Dollar Coin - Stablecoin)
        console.log("\n--- Deploying SGDC ---");
        sgdc = new SGDC(admin, stablecoinProvider);
        console.log("SGDC deployed at:", address(sgdc));

        // Step 2: Deploy TES3 (Tokenized ETF)
        // Initially deploy with zero address for dCDP, will update after dCDP deployment
        console.log("\n--- Deploying TES3 ---");
        tes3 = new TES3(admin, address(0));
        console.log("TES3 deployed at:", address(tes3));

        // Step 3: Deploy dCDP (Decentralized CDP Protocol)
        console.log("\n--- Deploying dCDP ---");
        dcdp = new dCDP(admin, address(tes3));
        console.log("dCDP deployed at:", address(dcdp));

        // Step 4: Update TES3 to point to dCDP contract
        console.log("\n--- Linking TES3 to dCDP ---");
        tes3.setDCDP(address(dcdp));
        console.log("TES3 dCDP address updated to:", address(dcdp));

        // Step 5: Create AP's wallet automatically
        console.log("\n--- Creating AP's wallet ---");
        dcdp.createWallet("AP", AP_ADDRESS);
        console.log("AP wallet created: AP ->", AP_ADDRESS);

        // Step 6: Mint 1,000,000 SGDC to AP wallet
        console.log("\n--- Minting SGDC to AP ---");
        sgdc.mint(AP_ADDRESS, 1000000 ether);
        console.log("Minted 1,000,000 SGDC to AP at address:", AP_ADDRESS);

        vm.stopBroadcast();

        // Display summary
        console.log("\n=== Deployment Summary ===");
        console.log("SGDC Token:", address(sgdc));
        console.log("TES3 Token:", address(tes3));
        console.log("dCDP Protocol:", address(dcdp));
        console.log("Admin:", admin);
        console.log("Stablecoin Provider:", stablecoinProvider);

        // Save deployment addresses to file for frontend use
        saveDeploymentInfo();
    }

    /**
     * @notice Save deployment addresses and ABIs to JSON file
     * @dev Creates a deployment-info.json file that frontend can read
     */
    function saveDeploymentInfo() internal {
        string memory json = string.concat(
            "{\n",
            '  "network": "anvil",\n',
            '  "chainId": 31337,\n',
            '  "contracts": {\n',
            string.concat('    "SGDC": {\n      "address": "', vm.toString(address(sgdc)), '"\n    },\n'),
            string.concat('    "TES3": {\n      "address": "', vm.toString(address(tes3)), '"\n    },\n'),
            string.concat('    "dCDP": {\n      "address": "', vm.toString(address(dcdp)), '"\n    }\n'),
            "  },\n",
            string.concat('  "admin": "', vm.toString(admin), '",\n'),
            string.concat('  "stablecoinProvider": "', vm.toString(stablecoinProvider), '"\n'),
            "}\n"
        );

        vm.writeFile("deployment-info.json", json);
        console.log("\nDeployment info saved to deployment-info.json");
    }
}

