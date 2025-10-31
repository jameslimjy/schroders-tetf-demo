# Frontend Integration Guide - Tokenized ETF Backend

## Overview

This document explains the backend implementation and how the frontend should integrate with it. The backend consists of three smart contracts deployed on a local Anvil blockchain, plus helper scripts for offchain operations.

## Backend Architecture

### Smart Contracts Deployed

All contracts are ERC-20 compatible and use 18 decimals for fractional ownership support.

#### 1. SGDC (Singapore Dollar Coin) - Stablecoin
- **Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Purpose**: Digital cash for instant settlement
- **Key Functions**:
  - `mint(address to, uint256 amount)` - Only callable by minter (stablecoin provider)
  - `transfer(address to, uint256 amount)` - Standard ERC-20 transfer
  - `balanceOf(address account)` - Check balance
- **Events**: Standard ERC-20 Transfer events

#### 2. TES3 (Tokenized SPDR STI ETF)
- **Address**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **Purpose**: Tokenized version of ES3 ETF shares
- **Key Functions**:
  - `mint(address to, uint256 amount)` - Only callable by dCDP contract
  - `burn(address from, uint256 amount)` - Only callable by dCDP contract
  - `transfer(address to, uint256 amount)` - Standard ERC-20 transfer
  - `balanceOf(address account)` - Check balance
- **Events**: Standard ERC-20 Transfer events

#### 3. dCDP (Decentralized Central Depository Protocol)
- **Address**: `0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0`
- **Purpose**: Protocol contract managing tokenization and wallet creation
- **Key Functions**:
  - `createWallet(string memory owner_id, address walletAddress)` - Creates wallet mapping (admin only)
  - `tokenize(string memory owner_id, uint256 quantity, string memory symbol)` - Tokenizes securities (admin only)
  - `ownerToAddress(string memory owner_id)` - Get wallet address for owner_id
  - `addressToOwner(address walletAddress)` - Get owner_id for wallet address
- **Events**:
  - `WalletCreated(string indexed owner_id, address indexed walletAddress)`
  - `Tokenized(string indexed owner_id, string symbol, uint256 quantity, address indexed tokenAddress)`

### Network Configuration

- **RPC URL**: `http://localhost:8545`
- **Chain ID**: `31337`
- **Network Name**: `anvil` (local development)

### Deployment Info

Contract addresses are saved in `backend/deployment-info.json`:
```json
{
  "network": "anvil",
  "chainId": 31337,
  "contracts": {
    "SGDC": { "address": "0x5FbDB2315678afecb367f032d93F642f64180aa3" },
    "TES3": { "address": "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" },
    "dCDP": { "address": "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" }
  },
  "admin": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "stablecoinProvider": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
}
```

## Integration Requirements

### 1. Reading Contract Addresses

The frontend should read `backend/deployment-info.json` to get contract addresses:

```javascript
import deploymentInfo from '../backend/deployment-info.json';

const SGDC_ADDRESS = deploymentInfo.contracts.SGDC.address;
const TES3_ADDRESS = deploymentInfo.contracts.TES3.address;
const DCDP_ADDRESS = deploymentInfo.contracts.dCDP.address;
```

### 2. Connecting to Anvil

Use ethers.js or web3.js to connect:

```javascript
import { ethers } from 'ethers';

const provider = new ethers.JsonRpcProvider('http://localhost:8545');
```

### 3. Loading Contract ABIs

Contract ABIs are compiled by Foundry and stored in:
- `backend/out/SGDC.sol/SGDC.json` → `abi` field
- `backend/out/TES3.sol/TES3.json` → `abi` field
- `backend/out/dCDP.sol/dCDP.json` → `abi` field

```javascript
import SGDC_ABI from '../backend/out/SGDC.sol/SGDC.json';
import TES3_ABI from '../backend/out/TES3.sol/TES3.json';
import DCDP_ABI from '../backend/out/dCDP.sol/dCDP.json';

const sgdcContract = new ethers.Contract(SGDC_ADDRESS, SGDC_ABI.abi, provider);
const tes3Contract = new ethers.Contract(TES3_ADDRESS, TES3_ABI.abi, provider);
const dcdpContract = new ethers.Contract(DCDP_ADDRESS, DCDP_ABI.abi, provider);
```

### 4. Account Management

**Anvil Default Accounts** (pre-funded with 10,000 ETH each):
- Account #0 (Admin): `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Account #1 (AP): `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- Account #2 (Thomas): `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`

**For Frontend Wallet Connection:**
- Use MetaMask or ethers.js wallet provider
- Connect to `http://localhost:8545`
- Import Anvil accounts using their private keys (found in Anvil startup output)

### 5. Key Workflows

#### A. Create Wallet for User
```javascript
// Admin calls this
const signer = provider.getSigner(adminAddress);
const dcdpWithSigner = dcdpContract.connect(signer);
await dcdpWithSigner.createWallet("THOMAS", thomasWalletAddress);
```

#### B. Mint Stablecoin (Onramp)
```javascript
// Stablecoin provider calls this
const signer = provider.getSigner(stablecoinProviderAddress);
const sgdcWithSigner = sgdcContract.connect(signer);
await sgdcWithSigner.mint(userAddress, ethers.parseUnits("1000", 18)); // 1000 SGDC
```

#### C. Tokenize ETF Shares
```javascript
// Admin calls this (after offchain CDP registry validation)
const signer = provider.getSigner(adminAddress);
const dcdpWithSigner = dcdPContract.connect(signer);
await dcdpWithSigner.tokenize("AP", ethers.parseUnits("50", 18), "ES3"); // 50 TES3
```

#### D. Buy Tokenized Asset (Thomas buys from AP)
```javascript
// Fixed price: $100 per TES3
const tes3Amount = ethers.parseUnits("5.5", 18); // 5.5 TES3
const sgdcAmount = ethers.parseUnits("550", 18); // 550 SGDC (5.5 * 100)

// Step 1: Thomas approves AP to spend SGDC (or use transferFrom)
const thomasSigner = provider.getSigner(thomasAddress);
const sgdcWithThomas = sgdcContract.connect(thomasSigner);
await sgdcWithThomas.approve(apAddress, sgdcAmount);

// Step 2: AP approves Thomas to spend TES3
const apSigner = provider.getSigner(apAddress);
const tes3WithAP = tes3Contract.connect(apSigner);
await tes3WithAP.approve(thomasAddress, tes3Amount);

// Step 3: Execute atomic swap (both transfers)
await sgdcContract.connect(thomasSigner).transferFrom(thomasAddress, apAddress, sgdcAmount);
await tes3Contract.connect(apSigner).transferFrom(apAddress, thomasAddress, tes3Amount);
```

#### E. Listen to Events
```javascript
// Listen for wallet creation
dcdpContract.on("WalletCreated", (ownerId, walletAddress, event) => {
  console.log(`Wallet created: ${ownerId} -> ${walletAddress}`);
});

// Listen for tokenization
dcdpContract.on("Tokenized", (ownerId, symbol, quantity, tokenAddress, event) => {
  console.log(`Tokenized: ${ownerId} got ${ethers.formatUnits(quantity, 18)} ${symbol}`);
});

// Listen for transfers
sgdcContract.on("Transfer", (from, to, amount, event) => {
  console.log(`SGDC Transfer: ${ethers.formatUnits(amount, 18)} from ${from} to ${to}`);
});

tes3Contract.on("Transfer", (from, to, amount, event) => {
  console.log(`TES3 Transfer: ${ethers.formatUnits(amount, 18)} from ${from} to ${to}`);
});
```

### 6. Reading Balances

```javascript
// Read SGDC balance
const sgdcBalance = await sgdcContract.balanceOf(userAddress);
console.log(`SGDC Balance: ${ethers.formatUnits(sgdcBalance, 18)}`);

// Read TES3 balance
const tes3Balance = await tes3Contract.balanceOf(userAddress);
console.log(`TES3 Balance: ${ethers.formatUnits(tes3Balance, 18)}`);
```

### 7. CDP Registry (Offchain Data)

The CDP registry is stored in `backend/data/cdp-registry.json`. This is **read-only** for the frontend (updated by backend scripts). The frontend should:

- Read this file to display traditional securities balances
- Display both stocks and ETFs for each account
- Update the display when CDP registry changes (polling or file watcher)

**Important**: CDP registry updates happen offchain via scripts (`createETF.js`, `tokenize.js`). The frontend should not modify this file directly.

## Storyboard Implementation Guide

### Step 1: ETF Creation (Offchain)
- Frontend calls backend script: `node backend/script/createETF.js AP ES3 100`
- Frontend reads updated `cdp-registry.json` to show new ES3 balance

### Step 2: Tokenization
- Frontend calls backend script: `node backend/script/tokenize.js AP ES3 50 <admin-private-key>`
- Frontend listens for `Tokenized` event from dCDP contract
- Frontend updates dCDP registry display (query TES3 balance)

### Step 3: Listing
- No blockchain interaction needed
- Frontend UI shows AP's TES3 available for trading

### Step 4: Account Creation
- Frontend calls `dCDP.createWallet("THOMAS", thomasWalletAddress)` (admin account)
- Frontend listens for `WalletCreated` event
- Frontend shows Thomas in dCDP registry with zero balances

### Step 5: Onramp Stablecoin
- Frontend calls `SGDC.mint(thomasAddress, amount)` (stablecoin provider account)
- Frontend listens for `Transfer` event from SGDC
- Frontend updates Thomas's SGDC balance

### Step 6: Buy Tokenized Asset
- Frontend executes atomic swap (see workflow D above)
- Frontend listens for both `Transfer` events
- Frontend updates both registries

### Step 7: Sell Tokenized Asset
- Reverse of Step 6 (Thomas sends TES3, receives SGDC)

## Fixed Price Mechanism

- **TES3 Price**: $100 per token (fixed, no price discovery)
- All buy/sell transactions use this fixed price
- Frontend should validate: `sgdcAmount = tes3Amount * 100`

## Decimal Handling

All tokens use 18 decimals. Frontend must convert:

```javascript
// User input: 5.5 TES3
const userInput = "5.5";
const amountWei = ethers.parseUnits(userInput, 18);

// Display: Convert wei back to human-readable
const balanceWei = await tes3Contract.balanceOf(address);
const balanceDisplay = ethers.formatUnits(balanceWei, 18); // "5.5"
```

## Testing Checklist

Before demo launch, verify:
- [ ] Can connect to Anvil at `http://localhost:8545`
- [ ] Can read contract addresses from `deployment-info.json`
- [ ] Can load contract ABIs from `out/` directory
- [ ] Can create wallets via `dCDP.createWallet()`
- [ ] Can mint SGDC via `SGDC.mint()`
- [ ] Can tokenize via `dCDP.tokenize()`
- [ ] Can transfer SGDC and TES3 tokens
- [ ] Can listen to events (WalletCreated, Tokenized, Transfer)
- [ ] Can read balances for all accounts
- [ ] Can read CDP registry JSON file
- [ ] All 7 storyboard steps work end-to-end

## Error Handling

Common errors and solutions:

1. **"Connection refused"**: Anvil not running → Check if `http://localhost:8545` is accessible
2. **"caller is not the admin"**: Wrong account signing → Use admin account for admin functions
3. **"caller is not the minter"**: Wrong account → Use stablecoin provider for SGDC.mint()
4. **"caller is not the dCDP contract"**: Cannot call TES3.mint() directly → Use dCDP.tokenize()
5. **"insufficient balance"**: Check balance before transfers
6. **"owner_id does not have a registered wallet"**: Create wallet first via dCDP.createWallet()

## Notes

- This is a demo project - security is simplified for demonstration
- All accounts are local Anvil accounts (not real wallets)
- Contracts use simplified access control
- CDP registry is a JSON file (simulating traditional database)
- No real funds or securities involved

