/**
 * @file createETF.js
 * @notice Offchain script to create ETF shares from underlying stocks
 * @dev Reads ETF composition, validates AP has sufficient holdings, updates CDP registry
 * 
 * This is an offchain operation that simulates the traditional ETF creation process.
 * It decreases constituent stock balances and increases ETF balance in the CDP registry.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to CDP registry JSON file
const CDP_REGISTRY_PATH = path.join(__dirname, '../data/cdp-registry.json');

/**
 * Create ETF shares from underlying stocks
 * @param {string} ownerId - Owner ID (e.g., "AP")
 * @param {string} etfSymbol - ETF symbol (e.g., "ES3")
 * @param {number} quantity - Number of ETF shares to create
 */
function createETF(ownerId, etfSymbol, quantity) {
    console.log(`\n=== Creating ${quantity} ${etfSymbol} shares for ${ownerId} ===\n`);

    // Read CDP registry
    const registry = JSON.parse(fs.readFileSync(CDP_REGISTRY_PATH, 'utf8'));

    // Validate owner exists
    if (!registry.accounts[ownerId]) {
        throw new Error(`Owner ${ownerId} not found in CDP registry`);
    }

    // Validate ETF composition exists
    if (!registry.etf_compositions[etfSymbol]) {
        throw new Error(`ETF ${etfSymbol} composition not found`);
    }

    const account = registry.accounts[ownerId];
    const composition = registry.etf_compositions[etfSymbol];

    // Initialize ETF balance if it doesn't exist
    if (!account.etfs[etfSymbol]) {
        account.etfs[etfSymbol] = 0;
    }

    // Validate sufficient holdings for each constituent stock
    console.log('Validating sufficient holdings...');
    const constituents = composition.constituents;
    
    for (const [stockSymbol, requiredPerETF] of Object.entries(constituents)) {
        const currentBalance = account.stocks[stockSymbol] || 0;
        const required = requiredPerETF * quantity;

        if (currentBalance < required) {
            throw new Error(
                `Insufficient ${stockSymbol}: have ${currentBalance}, need ${required} ` +
                `(${requiredPerETF} per ETF × ${quantity} ETFs)`
            );
        }

        console.log(`  ✓ ${stockSymbol}: ${currentBalance} → ${currentBalance - required} (need ${required})`);
    }

    // Deduct constituent stocks and add ETF shares
    console.log('\nUpdating balances...');
    for (const [stockSymbol, requiredPerETF] of Object.entries(constituents)) {
        const required = requiredPerETF * quantity;
        account.stocks[stockSymbol] -= required;
        console.log(`  ✓ Deducted ${required} ${stockSymbol}`);
    }

    // Increase ETF balance
    account.etfs[etfSymbol] += quantity;
    console.log(`  ✓ Added ${quantity} ${etfSymbol} shares`);
    console.log(`  ✓ New ${etfSymbol} balance: ${account.etfs[etfSymbol]}`);

    // Write updated registry back to file
    fs.writeFileSync(CDP_REGISTRY_PATH, JSON.stringify(registry, null, 2));
    console.log('\n✓ CDP registry updated successfully');

    return {
        success: true,
        newETFBalance: account.etfs[etfSymbol],
        deductedStocks: Object.fromEntries(
            Object.entries(constituents).map(([symbol, perETF]) => [
                symbol,
                perETF * quantity
            ])
        )
    };
}

// Command line interface
if (import.meta.url === `file://${process.argv[1]}`) {
    const args = process.argv.slice(2);
    
    if (args.length !== 3) {
        console.error('Usage: node createETF.js <ownerId> <etfSymbol> <quantity>');
        console.error('Example: node createETF.js AP ES3 100');
        process.exit(1);
    }

    const [ownerId, etfSymbol, quantityStr] = args;
    const quantity = parseInt(quantityStr, 10);

    if (isNaN(quantity) || quantity <= 0) {
        console.error('Error: quantity must be a positive number');
        process.exit(1);
    }

    try {
        const result = createETF(ownerId, etfSymbol, quantity);
        console.log('\n=== Success ===');
        console.log(JSON.stringify(result, null, 2));
    } catch (error) {
        console.error('\n=== Error ===');
        console.error(error.message);
        process.exit(1);
    }
}

export { createETF };

