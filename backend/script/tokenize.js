/**
 * @file tokenize.js
 * @notice Offchain script to tokenize traditional securities via dCDP
 * @dev Validates CDP balance, calls dCDP.tokenize(), updates CDP registry
 * 
 * This script bridges the offchain CDP registry with the onchain dCDP contract.
 * It ensures CDP balance is sufficient, calls the smart contract, then updates
 * the CDP registry to reflect the tokenization.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ethers } from 'ethers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const CDP_REGISTRY_PATH = path.join(__dirname, '../data/cdp-registry.json');
const DEPLOYMENT_INFO_PATH = path.join(__dirname, '../deployment-info.json');

// RPC URL for Anvil (default local network)
const RPC_URL = process.env.RPC_URL || 'http://localhost:8545';

/**
 * Tokenize traditional securities into tokenized tokens
 * @param {string} ownerId - Owner ID (e.g., "AP")
 * @param {string} symbol - Security symbol (e.g., "ES3")
 * @param {number} quantity - Quantity to tokenize
 * @param {string} privateKey - Private key of admin account (for signing transactions)
 */
async function tokenize(ownerId, symbol, quantity, privateKey) {
    console.log(`\n=== Tokenizing ${quantity} ${symbol} for ${ownerId} ===\n`);

    // Read CDP registry
    const registry = JSON.parse(fs.readFileSync(CDP_REGISTRY_PATH, 'utf8'));

    // Validate owner exists
    if (!registry.accounts[ownerId]) {
        throw new Error(`Owner ${ownerId} not found in CDP registry`);
    }

    const account = registry.accounts[ownerId];

    // Validate sufficient balance
    if (symbol === 'ES3') {
        const currentBalance = account.etfs[symbol] || 0;
        if (currentBalance < quantity) {
            throw new Error(
                `Insufficient ${symbol}: have ${currentBalance}, need ${quantity}`
            );
        }
        console.log(`✓ Verified balance: ${currentBalance} ${symbol}`);
    } else {
        throw new Error(`Tokenization of ${symbol} not supported (only ES3 supported)`);
    }

    // Read deployment info to get contract addresses
    let deploymentInfo;
    try {
        deploymentInfo = JSON.parse(fs.readFileSync(DEPLOYMENT_INFO_PATH, 'utf8'));
    } catch (error) {
        throw new Error(
            'Deployment info not found. Please deploy contracts first using: forge script script/Deploy.s.sol --broadcast'
        );
    }

    // Connect to blockchain
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log(`✓ Connected to ${RPC_URL}`);
    console.log(`✓ Using admin account: ${wallet.address}`);

    // Load dCDP contract ABI (simplified - in production, load from artifacts)
    // For now, we'll use the minimal ABI needed
    const dCDP_ABI = [
        "function tokenize(string memory owner_id, uint256 quantity, string memory symbol) external",
        "function ownerToAddress(string memory) external view returns (address)"
    ];

    const dCDPAddress = deploymentInfo.contracts.dCDP.address;
    const dCDP = new ethers.Contract(dCDPAddress, dCDP_ABI, wallet);

    // Verify owner has a registered wallet
    const ownerAddress = await dCDP.ownerToAddress(ownerId);
    if (ownerAddress === ethers.ZeroAddress) {
        throw new Error(
            `Owner ${ownerId} does not have a registered wallet. ` +
            `Please create wallet first using dCDP.createWallet()`
        );
    }
    console.log(`✓ Owner ${ownerId} has wallet: ${ownerAddress}`);

    // Convert quantity to wei (18 decimals)
    const quantityWei = ethers.parseUnits(quantity.toString(), 18);
    console.log(`✓ Quantity in wei: ${quantityWei.toString()}`);

    // Call tokenize function
    console.log('\nCalling dCDP.tokenize()...');
    const tx = await dCDP.tokenize(ownerId, quantityWei, symbol);
    console.log(`  Transaction hash: ${tx.hash}`);
    console.log(`  Waiting for confirmation...`);

    const receipt = await tx.wait();
    console.log(`  ✓ Transaction confirmed in block ${receipt.blockNumber}`);

    // Update CDP registry (decrease traditional balance)
    console.log('\nUpdating CDP registry...');
    if (symbol === 'ES3') {
        account.etfs[symbol] -= quantity;
        console.log(`  ✓ Decreased ${symbol} balance: ${account.etfs[symbol] + quantity} → ${account.etfs[symbol]}`);
    }

    // Write updated registry back to file
    fs.writeFileSync(CDP_REGISTRY_PATH, JSON.stringify(registry, null, 2));
    console.log('  ✓ CDP registry updated');

    return {
        success: true,
        transactionHash: tx.hash,
        blockNumber: receipt.blockNumber,
        ownerId,
        symbol,
        quantity,
        ownerAddress
    };
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    
    if (args.length !== 4) {
        console.error('Usage: node tokenize.js <ownerId> <symbol> <quantity> <privateKey>');
        console.error('Example: node tokenize.js AP ES3 50 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80');
        console.error('\nNote: Use admin account private key');
        process.exit(1);
    }

    const [ownerId, symbol, quantityStr, privateKey] = args;
    const quantity = parseFloat(quantityStr);

    if (isNaN(quantity) || quantity <= 0) {
        console.error('Error: quantity must be a positive number');
        process.exit(1);
    }

    tokenize(ownerId, symbol, quantity, privateKey)
        .then(result => {
            console.log('\n=== Success ===');
            console.log(JSON.stringify(result, null, 2));
        })
        .catch(error => {
            console.error('\n=== Error ===');
            console.error(error.message);
            if (error.transaction) {
                console.error('Transaction:', error.transaction);
            }
            process.exit(1);
        });
}

export { tokenize };

