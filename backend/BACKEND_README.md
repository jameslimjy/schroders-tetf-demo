# Tokenized ETF Backend - Implementation Summary

## Overview

This backend implements the smart contract foundation for the Tokenized ETF (TETF) demo project. All contracts are written in Solidity using Foundry framework and follow the specifications in `PROJECT_SPECIFICATION.md`.

## Contracts Implemented

### 1. SGDC.sol - Singapore Dollar Coin (Stablecoin)
- **Purpose**: ERC-20 stablecoin representing Singapore dollars
- **Features**:
  - Standard ERC-20 functionality
  - Minting restricted to authorized minter (stablecoin provider)
  - 18 decimals for precision
  - Owner can update minter address
- **Location**: `src/SGDC.sol`

### 2. TES3.sol - Tokenized SPDR STI ETF
- **Purpose**: ERC-20 token representing tokenized ES3 shares
- **Features**:
  - Standard ERC-20 functionality
  - Mint/burn restricted to dCDP contract only
  - 18 decimals enable fractional ownership (e.g., 5.5 TES3)
  - Owner can update dCDP address
- **Location**: `src/TES3.sol`

### 3. dCDP.sol - Decentralized Central Depository Protocol
- **Purpose**: Protocol contract managing tokenization and wallet creation
- **Features**:
  - Maps owner_id (string) to Ethereum addresses
  - Tokenizes traditional securities (ES3) into tokenized tokens (TES3)
  - Creates wallets for new users
  - Emits events for tracking operations
- **Location**: `src/dCDP.sol`

## Test Coverage

All contracts have comprehensive test suites:

- **SGDC Tests**: 10 tests covering minting, transfers, access control
- **TES3 Tests**: 14 tests covering minting, burning, fractional ownership
- **dCDP Tests**: 24 tests covering wallet creation, tokenization, access control

**Total: 48 tests, all passing**

## Deployment

### Prerequisites
- Foundry installed (forge, anvil, cast)
- Anvil running on `http://localhost:8545` (for local testing)

### Deploy Contracts

```bash
# Start Anvil in a separate terminal
anvil

# Deploy all contracts
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545

# Deployment info will be saved to deployment-info.json
```

The deployment script:
1. Deploys SGDC with admin as owner and minter
2. Deploys TES3 (initially with zero dCDP address)
3. Deploys dCDP with TES3 address
4. Links TES3 to dCDP
5. Saves all addresses to `deployment-info.json`

## Offchain Operations

### CDP Registry

The CDP registry (`data/cdp-registry.json`) simulates the traditional depository database:
- Contains account balances for AP and THOMAS
- Includes ETF composition data for ES3
- Updated by offchain scripts

### Helper Scripts

**Setup Node.js dependencies:**
```bash
cd script
npm install
```

**1. createETF.js** - Create ETF shares from underlying stocks
```bash
node createETF.js <ownerId> <etfSymbol> <quantity>
# Example: node createETF.js AP ES3 100
```

**2. tokenize.js** - Tokenize traditional securities via dCDP
```bash
node tokenize.js <ownerId> <symbol> <quantity> <privateKey>
# Example: node tokenize.js AP ES3 50 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Testing

Run all tests:
```bash
forge test
```

Run specific test file:
```bash
forge test --match-path test/SGDC.t.sol
```

Run with gas reporting:
```bash
forge test --gas-report
```

## Project Structure

```
backend/
├── src/
│   ├── SGDC.sol          # Stablecoin contract
│   ├── TES3.sol          # Tokenized ETF contract
│   └── dCDP.sol          # Protocol contract
├── test/
│   ├── SGDC.t.sol        # SGDC tests
│   ├── TES3.t.sol        # TES3 tests
│   └── dCDP.t.sol        # dCDP tests
├── script/
│   ├── Deploy.s.sol      # Deployment script
│   ├── createETF.js      # Offchain ETF creation
│   └── tokenize.js        # Offchain tokenization
├── data/
│   └── cdp-registry.json # CDP registry data
├── foundry.toml          # Foundry configuration
└── deployment-info.json  # Generated after deployment
```

## Key Design Decisions

1. **Access Control**: Using OpenZeppelin's `Ownable` for admin functions
2. **Zero Address Handling**: TES3 allows zero address in constructor to enable deployment before dCDP, then requires `setDCDP()` call
3. **Fractional Ownership**: All tokens use 18 decimals, enabling fractional amounts like 5.5 TES3
4. **Offchain Integration**: CDP registry is JSON file (simulating traditional database); scripts bridge offchain and onchain operations

## Next Steps

1. **Frontend Integration**: Connect React frontend to deployed contracts
2. **Event Listening**: Frontend should listen to `WalletCreated` and `Tokenized` events
3. **Account Management**: Create wallets for AP and THOMAS via `dCDP.createWallet()`
4. **Complete Storyboard**: Execute all 7 steps from the project specification

## Notes

- This is a demo project, not production-ready
- Contracts use simplified access control for demonstration
- CDP registry verification happens offchain before calling `tokenize()`
- Fixed price mechanism: TES3 = $100 per token (no price discovery)

