# Tokenized ETF Backend

## Overview

This document summarizes the smart contract layer for the Tokenized ETF demo. All contracts follow the specification in `PROJECT_SPECIFICATION.md` and are authored with the Foundry toolchain.

## Contract Summary

### SGDC.sol — Singapore Dollar Coin
- **Purpose**: ERC-20 stablecoin that mirrors Singapore dollar balances.
- **Key features**: Standard ERC-20 behaviour, restricted minter role, owner-controlled minter rotation, 18 decimal places for precise accounting.
- **Source**: `src/SGDC.sol`

### TES3.sol — Tokenized SPDR STI ETF
- **Purpose**: ERC-20 representation of tokenized ES3 ETF shares.
- **Key features**: Mint and burn limited to the dCDP contract, 18 decimal places for fractional ownership, owner-controlled dCDP assignment.
- **Source**: `src/TES3.sol`

### dCDP.sol — Decentralized Central Depository Protocol
- **Purpose**: Coordinates wallet issuance and tokenization flows.
- **Key features**: Maps offchain identifiers to onchain addresses, validates tokenization requests, emits lifecycle events, centralizes mint and burn of TES3.
- **Source**: `src/dCDP.sol`

## Test Coverage

The suite contains 48 tests across SGDC, TES3, and dCDP. They cover minting, burning, access control, fractional transfers, event emission, and failure cases. All tests pass under Foundry.

```bash
forge test
```

## Deployment Workflow

### Prerequisites
- Foundry installed (`forge`, `anvil`, `cast`).
- Anvil listening on `http://localhost:8545`.

### Deploy Contracts

```bash
# Terminal 1: start Anvil
anvil

# Terminal 2: deploy the suite
forge script script/Deploy.s.sol --broadcast --rpc-url http://localhost:8545
```

The deployment script performs the following steps:
1. Deploys SGDC with the admin configured as owner and minter.
2. Deploys TES3 with a temporary zero dCDP address.
3. Deploys dCDP with the TES3 address supplied.
4. Calls `setDCDP()` on TES3 to complete the linkage.
5. Writes deployed addresses to `deployment-info.json`.

## Offchain Data and Scripts

### CDP Registry

`data/cdp-registry.json` mirrors the traditional central depository records. It holds ETF composition data, custodial balances for the authorised participant (AP), and balances for Thomas. The JSON file is updated by the helper scripts described below.

### Helper Scripts

Install script dependencies once.

```bash
cd script
npm install
```

**createETF.js**  
Creates conventional ETF shares prior to tokenization.

```bash
node createETF.js <ownerId> <etfSymbol> <quantity>
# Example: node createETF.js AP ES3 100
```

**tokenize.js**  
Locks traditional shares and mints the TES3 tokens via dCDP.

```bash
node tokenize.js <ownerId> <symbol> <quantity> <privateKey>
# Example: node tokenize.js AP ES3 50 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

## Additional Test Commands

- Run a single contract suite  
  `forge test --match-path test/SGDC.t.sol`
- Include gas reporting  
  `forge test --gas-report`

## Directory Layout

```
backend/
├── src/                  Solidity contracts
├── test/                 Foundry tests
├── script/               Deployment and helper scripts
├── data/                 Offchain registry data
├── foundry.toml          Foundry configuration
└── deployment-info.json  Generated deployment artifact
```

## Design Considerations

1. **Access control**: Contracts rely on OpenZeppelin `Ownable` to keep the demo easy to audit and extend.  
2. **Deployment ordering**: TES3 accepts a zero dCDP during construction so deployment can complete before the protocol address is known.  
3. **Fractional ownership**: 18 decimals on all tokens support fractional share scenarios such as 5.5 TES3.  
4. **Offchain validation**: Tokenization assumes prior offchain checks against the CDP registry before calling `tokenize()`.

## Next Steps

1. Extend the React frontend to consume events (`WalletCreated`, `Tokenized`, `Transfer`).  
2. Add account management flows for AP and Thomas via `dCDP.createWallet()`.  
3. Execute the storyboard end-to-end and document observed metrics.  
4. Evaluate production hardening (role separation, pausing mechanisms, audit requirements).

## Notes

- The project demonstrates concepts and is not ready for production deployment.  
- Access control is intentionally simplified for clarity.  
- The price model is fixed at TES3 = SGD 100 and does not implement live market pricing.

